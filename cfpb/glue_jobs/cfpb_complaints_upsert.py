"""
cfpb_complaints_upsert.py
=========================
AWS Glue 5.0 (Spark 3.5) ETL job.

Downloads the full CFPB Consumer Complaint Database dump, lands the raw CSV in S3,
and upserts it into an Apache Iceberg table registered in the Glue Data Catalog.

Why a full re-pull every run?
-----------------------------
The CFPB refreshes the database daily, but it MUTATES EXISTING ROWS IN PLACE:
`company_response_to_consumer`, `timely_response` and `company_public_response`
are all backfilled days or weeks after the complaint was first received. A
date-window incremental load would silently miss those updates.

So: pull the whole file, compute a content hash per row, and MERGE. The hash makes
the merge cheap in practice — unchanged rows produce no write, so Iceberg only
rewrites the data files that actually contain drift.

Cleaning rules
--------------
Standardization decided in cfpb/data/cfpb.ipynb (formerly a separate
cfpb_complaints_standardize job) is applied inline before the row lands in
Iceberg: sub_product alias collapsing, issue grouping (unmapped -> "Unknown"),
company_response_to_consumer outcome-bucketing, and strict validation of
complaint_id / date_received / date_sent_to_company / timely_response — any
value outside the expected shape raises and fails the job rather than being
silently dropped or nulled, since a bad row would otherwise land unnoticed in
the merge target.

COLUMN_MAP must track the live file's column set and order exactly (see the
comment above it) — CFPB's documented schema also lists "Consumer consent
provided?" and "Consumer disputed?", but neither appears in the current bulk
CSV export.

Required job parameters
-----------------------
  --raw_bucket            S3 bucket for the raw landing zone
  --warehouse             s3://.../warehouse   (Iceberg warehouse root)
  --catalog_database      Glue database name (must already exist)

Optional job parameters
-----------------------
  --raw_prefix            default: raw/cfpb/complaints
  --table_name            default: complaints
  --source_url            default: https://files.consumerfinance.gov/ccdb/complaints.csv.zip
  --force_download        "true" to re-download even if today's object exists
  --merge_window_days     narrow the MERGE target scan to complaints received in the
                          last N days. FASTER BUT LOSSY - only use if you accept
                          missing late updates to old complaints. Omit for correctness.

Glue job configuration
----------------------
  Glue version:     5.0
  Worker type:      G.2X, 10 workers (tune down after the first backfill)
  Job parameters:   --datalake-formats = iceberg
                    --enable-glue-datacatalog = true
                    --enable-metrics = true
  IAM:              s3:GetObject/PutObject on raw_bucket + warehouse,
                    glue:*Table/*Database/*Partition on catalog_database
  Networking:       needs egress to files.consumerfinance.gov. If the job has a
                    Glue Connection into a VPC, that subnet needs a NAT gateway.
  Timeout:          120 min (the first full load is the slow one)
"""

import hashlib
import logging
import sys
import zipfile
from datetime import date, datetime, timedelta, timezone

import boto3
from botocore.exceptions import ClientError
from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark import SparkConf, SparkContext
from pyspark.sql import DataFrame, SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import StringType, StructField, StructType
from pyspark.sql.window import Window

logging.basicConfig(format="%(asctime)s %(levelname)s %(message)s", level=logging.INFO)
log = logging.getLogger("cfpb-upsert")

CATALOG = "glue_catalog"
DEFAULT_SOURCE_URL = "https://files.consumerfinance.gov/ccdb/complaints.csv.zip"

# files.consumerfinance.gov sits behind Akamai, which 403s requests that don't
# look like real browser traffic — a self-identifying User-Agent like
# "glue-cfpb-upsert/1.0" with no Accept/Accept-Language/Referer is exactly the
# kind of fingerprint bot-management rules flag, especially from AWS egress
# IPs. Spoofing a common desktop Chrome header set clears it. Accept-Encoding
# is pinned to "identity" so the response body stays the literal zip bytes —
# land_raw_csv() streams them straight through without decompression handling.
DOWNLOAD_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "identity",
    "Referer": "https://www.consumerfinance.gov/data-research/consumer-complaints/",
}

# ---------------------------------------------------------------------------
# 1. Parameters
# ---------------------------------------------------------------------------

REQUIRED = ["JOB_NAME", "raw_bucket", "warehouse", "catalog_database"]
OPTIONAL = {
    "raw_prefix": "raw/cfpb/complaints",
    "table_name": "complaints",
    "source_url": DEFAULT_SOURCE_URL,
    "force_download": "false",
    "merge_window_days": "",
}


def resolve_args() -> dict:
    """getResolvedOptions throws on absent optional params, so pre-filter argv."""
    present = [k for k in OPTIONAL if f"--{k}" in sys.argv]
    args = getResolvedOptions(sys.argv, REQUIRED + present)
    for key, default in OPTIONAL.items():
        args.setdefault(key, default)
    return args


args = resolve_args()
RAW_BUCKET = args["raw_bucket"]
RAW_PREFIX = args["raw_prefix"].strip("/")
WAREHOUSE = args["warehouse"].rstrip("/")
DATABASE = args["catalog_database"]
TABLE = args["table_name"]
FQTN = f"{CATALOG}.{DATABASE}.{TABLE}"
SOURCE_URL = args["source_url"]
FORCE_DOWNLOAD = args["force_download"].lower() == "true"
MERGE_WINDOW_DAYS = int(args["merge_window_days"]) if args["merge_window_days"] else None

RUN_DATE = date.today().isoformat()
RAW_KEY = f"{RAW_PREFIX}/load_date={RUN_DATE}/complaints.csv"
RAW_S3_URI = f"s3://{RAW_BUCKET}/{RAW_KEY}"

# ---------------------------------------------------------------------------
# 2. Spark / Iceberg bootstrap
#
# The Iceberg extensions must be set before the SparkContext exists, which is why
# we build the SparkConf ourselves rather than letting Glue construct the session.
# ---------------------------------------------------------------------------

conf = (
    SparkConf()
    .set("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions")
    .set(f"spark.sql.catalog.{CATALOG}", "org.apache.iceberg.spark.SparkCatalog")
    .set(f"spark.sql.catalog.{CATALOG}.warehouse", WAREHOUSE)
    .set(f"spark.sql.catalog.{CATALOG}.catalog-impl", "org.apache.iceberg.aws.glue.GlueCatalog")
    .set(f"spark.sql.catalog.{CATALOG}.io-impl", "org.apache.iceberg.aws.s3.S3FileIO")
    .set("spark.sql.iceberg.handle-timestamp-without-timezone", "true")
    # The narrative column is large and skewed; AQE keeps the merge shuffle sane.
    .set("spark.sql.adaptive.enabled", "true")
    .set("spark.sql.adaptive.coalescePartitions.enabled", "true")
    .set("spark.serializer", "org.apache.spark.serializer.KryoSerializer")
)

sc = SparkContext(conf=conf)
glue_context = GlueContext(sc)
spark: SparkSession = glue_context.spark_session
job = Job(glue_context)
job.init(args["JOB_NAME"], args)

s3 = boto3.client("s3")

# ---------------------------------------------------------------------------
# 3. Land the raw CSV in S3
# ---------------------------------------------------------------------------


def object_exists(bucket: str, key: str) -> bool:
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as exc:
        if exc.response["Error"]["Code"] in ("404", "NoSuchKey"):
            return False
        raise


def land_raw_csv() -> None:
    """Stream the zip to local disk, then stream the CSV member straight to S3.

    The zip is ~1 GB and expands to well over 10 GB. We write only the compressed
    file to the worker's local disk (zipfile needs a seekable handle to read the
    central directory) and pipe the decompressed member into a multipart upload,
    so the uncompressed payload never touches disk.
    """
    if object_exists(RAW_BUCKET, RAW_KEY) and not FORCE_DOWNLOAD:
        log.info("Raw object already present for %s, skipping download.", RUN_DATE)
        return

    import urllib.request

    local_zip = "/tmp/complaints.csv.zip"
    log.info("Downloading %s", SOURCE_URL)

    req = urllib.request.Request(SOURCE_URL, headers=DOWNLOAD_HEADERS)
    with urllib.request.urlopen(req, timeout=300) as resp, open(local_zip, "wb") as out:
        while True:
            chunk = resp.read(16 * 1024 * 1024)
            if not chunk:
                break
            out.write(chunk)

    with zipfile.ZipFile(local_zip) as zf:
        members = [n for n in zf.namelist() if n.lower().endswith(".csv")]
        if not members:
            raise RuntimeError(f"No CSV member found in archive: {zf.namelist()}")
        member = members[0]
        log.info("Uploading member %s to %s", member, RAW_S3_URI)
        with zf.open(member) as stream:
            s3.upload_fileobj(
                stream,
                RAW_BUCKET,
                RAW_KEY,
                ExtraArgs={"ContentType": "text/csv"},
                Config=boto3.s3.transfer.TransferConfig(multipart_chunksize=64 * 1024 * 1024),
            )
    log.info("Raw landing complete.")


# ---------------------------------------------------------------------------
# 4. Read + shape
# ---------------------------------------------------------------------------

# Header names exactly as they appear in the CFPB dump -> our snake_case columns.
#
# This must match the live file's column set and order exactly: read_raw()
# applies RAW_SCHEMA positionally (header=true only skips the header line, it
# does not map by name), so an extra or missing entry here silently shifts
# every later column into the wrong field. CFPB's documented schema also lists
# "Consumer consent provided?" and "Consumer disputed?", but neither appears
# in the current bulk CSV export — both were dropped from COLUMN_MAP to match.
COLUMN_MAP = {
    "Date received": "date_received",
    "Product": "product",
    "Sub-product": "sub_product",
    "Issue": "issue",
    "Sub-issue": "sub_issue",
    "Consumer complaint narrative": "consumer_complaint_narrative",
    "Company public response": "company_public_response",
    "Company": "company",
    "State": "state",
    "ZIP code": "zip_code",
    "Tags": "tags",
    "Submitted via": "submitted_via",
    "Date sent to company": "date_sent_to_company",
    "Company response to consumer": "company_response_to_consumer",
    "Timely response?": "timely_response",
    "Complaint ID": "complaint_id",
}

# Everything is read as string, then cast explicitly. Inferring the schema would
# cost a second full pass over ~10 GB and guesses wrong on zip_code ("331XX").
RAW_SCHEMA = StructType([StructField(c, StringType(), True) for c in COLUMN_MAP.values()])

# Columns that participate in change detection (excludes ingestion metadata).
HASH_COLUMNS = [c for c in COLUMN_MAP.values() if c != "complaint_id"]

# ---------------------------------------------------------------------------
# Cleaning rules, ported from cfpb_complaints_standardize.py (per-column
# decisions from cfpb/data/cfpb.ipynb). Consolidated here so there is one
# transformation path instead of a second job downstream of this one.
# ---------------------------------------------------------------------------

SUB_PRODUCT_COL = "sub_product"
ISSUE_COL = "issue"
COMPANY_RESPONSE_COL = "company_response_to_consumer"
TIMELY_RESPONSE_COL = "timely_response"

# Sub-product: known messy variants collapsed to one canonical label.
# Anything not listed here is left untouched.
SUB_PRODUCT_ALIASES = {
    "CD (Certificate of Deposit)": "Certificate of deposit (CD)",
    "(CD) Certificate of deposit": "Certificate of deposit (CD)",
    "Other banking product or service": "Other banking product or service",
    "Other bank product/service": "Other banking product or service",
    "Mobile or digital wallet": "Mobile or digital wallet",
    "Mobile wallet": "Mobile or digital wallet",
    "Credit repair services": "Credit repair services",
    "Credit repair": "Credit repair services",
    "Home equity loan or line of credit (HELOC)": "HELOC",
    "Home equity loan or line of credit": "HELOC",
    "Other type of mortgage": "Other mortgage",
    "Other mortgage": "Other mortgage",
    "General-purpose prepaid card": "General-purpose prepaid card",
    "General purpose card": "General-purpose prepaid card",
    "Gift card": "Gift or merchant card",
    "Gift or merchant card": "Gift or merchant card",
    "Government benefit card": "Government benefit card",
    "Government benefit payment card": "Government benefit card",
    "Traveler's check or cashier's check": "Traveler's or cashier's checks",
    "Traveler’s/Cashier’s checks": "Traveler's or cashier's checks",
    "Check cashing service": "Check cashing",
    "Check cashing": "Check cashing",
    "Cashing a check without an account": "Check cashing",
    "Tax refund anticipation loan or check": "Refund anticipation loan or check",
    "Refund anticipation check": "Refund anticipation loan or check",
    "Medical": "Medical debt",
    "Medical debt": "Medical debt",
}

# Issue: raw CFPB issue text collapsed into higher-level groups. Values not
# listed (and true nulls) fall through to "Unknown" below.
ISSUE_GROUPS = {
    # Debt collection
    "Took or threatened to take negative or legal action": "Debt collection",
    "False statements or representation": "Debt collection",
    "Attempts to collect debt not owed": "Debt collection",
    "Written notification about debt": "Debt collection",
    "Threatened to contact someone or share information improperly": "Debt collection",
    "Electronic communications": "Debt collection",
    "Communication tactics": "Debt collection",
    "Disclosure verification of debt": "Debt collection",
    "Cont'd attempts collect debt not owed": "Debt collection",
    "Taking/threatening an illegal action": "Debt collection",
    "Improper contact or sharing of info": "Debt collection",
    "Collection practices": "Debt collection",
    "Collection debt dispute": "Debt collection",
    # Credit reporting, monitoring, or identity protection
    "Incorrect information on your report": "Credit reporting, monitoring, or identity protection",
    "Improper use of your report": "Credit reporting, monitoring, or identity protection",
    "Unable to get your credit report or credit score": "Credit reporting, monitoring, or identity protection",
    "Problem with fraud alerts or security freezes": "Credit reporting, monitoring, or identity protection",
    "Identity theft protection or other monitoring services": "Credit reporting, monitoring, or identity protection",
    "Credit monitoring or identity theft protection services": "Credit reporting, monitoring, or identity protection",
    "Problem with credit report or credit score": "Credit reporting, monitoring, or identity protection",
    "Problem with a credit reporting company's investigation into an existing problem": "Credit reporting, monitoring, or identity protection",
    "Incorrect information on credit report": "Credit reporting, monitoring, or identity protection",
    "Credit reporting": "Credit reporting, monitoring, or identity protection",
    "Improper use of my credit report": "Credit reporting, monitoring, or identity protection",
    "Unable to get credit report/credit score": "Credit reporting, monitoring, or identity protection",
    "Credit reporting company's investigation": "Credit reporting, monitoring, or identity protection",
    "Credit monitoring or identity protection": "Credit reporting, monitoring, or identity protection",
    # Mortgage application, underwriting, or closing
    "Applying for a mortgage or refinancing an existing mortgage": "Mortgage application, underwriting, or closing",
    "Closing on a mortgage": "Mortgage application, underwriting, or closing",
    "Application, originator, mortgage broker": "Mortgage application, underwriting, or closing",
    "Credit decision / Underwriting": "Mortgage application, underwriting, or closing",
    "Settlement process and costs": "Mortgage application, underwriting, or closing",
    # Mortgage servicing, payment, or foreclosure
    "Dealing with your lender or servicer": "Mortgage servicing, payment, or foreclosure",
    "Struggling to pay mortgage": "Mortgage servicing, payment, or foreclosure",
    "Can't contact lender or servicer": "Mortgage servicing, payment, or foreclosure",
    "Loan modification,collection,foreclosure": "Mortgage servicing, payment, or foreclosure",
    "Loan servicing, payments, escrow account": "Mortgage servicing, payment, or foreclosure",
    "Dealing with my lender or servicer": "Mortgage servicing, payment, or foreclosure",
    "Can't contact lender": "Mortgage servicing, payment, or foreclosure",
    # Account opening, closing, or management
    "Managing an account": "Account opening, closing, or management",
    "Closing your account": "Account opening, closing, or management",
    "Opening an account": "Account opening, closing, or management",
    "Closing an account": "Account opening, closing, or management",
    "Account opening, closing, or management": "Account opening, closing, or management",
    "Closing/Cancelling account": "Account opening, closing, or management",
    "Managing, opening, or closing account": "Account opening, closing, or management",
    # Loan or lease application and funding
    "Getting a loan or lease": "Loan or lease application and funding",
    "Getting the loan": "Loan or lease application and funding",
    "Getting a line of credit": "Loan or lease application and funding",
    "Problems receiving the advance": "Loan or lease application and funding",
    "Getting a loan": "Loan or lease application and funding",
    "Was approved for a loan, but didn't receive the money": "Loan or lease application and funding",
    "Was approved for a loan, but didn't receive money": "Loan or lease application and funding",
    "Shopping for a loan or lease": "Loan or lease application and funding",
    "Applied for loan/did not receive money": "Loan or lease application and funding",
    "Taking out the loan or lease": "Loan or lease application and funding",
    "Shopping for a line of credit": "Loan or lease application and funding",
    # Loan or lease servicing, repayment, or payoff
    "Problem with the payoff process at the end of the loan": "Loan or lease servicing, repayment, or payoff",
    "Trouble during payment process": "Loan or lease servicing, repayment, or payoff",
    "Problem when making payments": "Loan or lease servicing, repayment, or payoff",
    "Problems at the end of the loan or lease": "Loan or lease servicing, repayment, or payoff",
    "Managing the loan or lease": "Loan or lease servicing, repayment, or payoff",
    "Issues with repayment": "Loan or lease servicing, repayment, or payoff",
    "Loan payment wasn't credited to your account": "Loan or lease servicing, repayment, or payoff",
    "Payoff process": "Loan or lease servicing, repayment, or payoff",
    "Payment to acct not credited": "Loan or lease servicing, repayment, or payoff",
    "Repaying your loan": "Loan or lease servicing, repayment, or payoff",
    "Managing the line of credit": "Loan or lease servicing, repayment, or payoff",
    # Financial hardship, delinquency, or workout
    "Struggling to repay your loan": "Financial hardship, delinquency, or workout",
    "Struggling to pay your loan": "Financial hardship, delinquency, or workout",
    "Struggling to pay your bill": "Financial hardship, delinquency, or workout",
    "Problems when you are unable to pay": "Financial hardship, delinquency, or workout",
    "Can't repay my loan": "Financial hardship, delinquency, or workout",
    "Delinquent account": "Financial hardship, delinquency, or workout",
    "Forbearance / Workout plans": "Financial hardship, delinquency, or workout",
    "Bankruptcy": "Financial hardship, delinquency, or workout",
    # Repossession, sale, or property damage
    "Vehicle was repossessed or sold the vehicle": "Repossession, sale, or property damage",
    "Repossession": "Repossession, sale, or property damage",
    "Vehicle was damaged or destroyed the vehicle": "Repossession, sale, or property damage",
    "Property was damaged or destroyed property": "Repossession, sale, or property damage",
    "Property was sold": "Repossession, sale, or property damage",
    "Lender repossessed or sold the vehicle": "Repossession, sale, or property damage",
    "Lender damaged or destroyed vehicle": "Repossession, sale, or property damage",
    "Lender sold the property": "Repossession, sale, or property damage",
    "Lender damaged or destroyed property": "Repossession, sale, or property damage",
    # Card application, access, or account management
    "Trouble using the card": "Card application, access, or account management",
    "Trouble using your card": "Card application, access, or account management",
    "Getting a credit card": "Card application, access, or account management",
    "Problem getting a card or closing an account": "Card application, access, or account management",
    "Credit limit changed": "Card application, access, or account management",
    "Using a debit or ATM card": "Card application, access, or account management",
    "Credit determination": "Card application, access, or account management",
    "Credit line increase/decrease": "Card application, access, or account management",
    "Application processing delay": "Card application, access, or account management",
    "Unsolicited issuance of credit card": "Card application, access, or account management",
    # Billing, statements, or payment posting
    "Problem with a purchase shown on your statement": "Billing, statements, or payment posting",
    "Billing disputes": "Billing, statements, or payment posting",
    "Billing statement": "Billing, statements, or payment posting",
    # Fees, interest, or exchange rates
    "Charged fees or interest you didn't expect": "Fees, interest, or exchange rates",
    "Fees or interest": "Fees, interest, or exchange rates",
    "Charged upfront or unexpected fees": "Fees, interest, or exchange rates",
    "Unexpected or other fees": "Fees, interest, or exchange rates",
    "Incorrect exchange rate": "Fees, interest, or exchange rates",
    "Unexpected fees": "Fees, interest, or exchange rates",
    "Excessive fees": "Fees, interest, or exchange rates",
    "Overlimit fee": "Fees, interest, or exchange rates",
    "Late fee": "Fees, interest, or exchange rates",
    "APR or interest rate": "Fees, interest, or exchange rates",
    "Other fee": "Fees, interest, or exchange rates",
    "Charged fees or interest I didn't expect": "Fees, interest, or exchange rates",
    "Cash advance fee": "Fees, interest, or exchange rates",
    "Fees": "Fees, interest, or exchange rates",
    "Unexpected/Other fees": "Fees, interest, or exchange rates",
    "Balance transfer fee": "Fees, interest, or exchange rates",
    # Transactions, transfers, or payment instruments
    "Problem with a purchase or transfer": "Transactions, transfers, or payment instruments",
    "Other transaction problem": "Transactions, transfers, or payment instruments",
    "Wrong amount charged or received": "Transactions, transfers, or payment instruments",
    "Lost or stolen money order": "Transactions, transfers, or payment instruments",
    "Lost or stolen refund": "Transactions, transfers, or payment instruments",
    "Deposits and withdrawals": "Transactions, transfers, or payment instruments",
    "Lost or stolen check": "Transactions, transfers, or payment instruments",
    "Making/receiving payments, sending money": "Transactions, transfers, or payment instruments",
    "Transaction issue": "Transactions, transfers, or payment instruments",
    "Other transaction issues": "Transactions, transfers, or payment instruments",
    # Fraud, scams, or unauthorized activity
    "Unauthorized transactions or other transaction problem": "Fraud, scams, or unauthorized activity",
    "Fraud or scam": "Fraud, scams, or unauthorized activity",
    "Problem with a lender or other company charging your account": "Fraud, scams, or unauthorized activity",
    "Unauthorized withdrawals or charges": "Fraud, scams, or unauthorized activity",
    "Can't stop withdrawals from your bank account": "Fraud, scams, or unauthorized activity",
    "Money was taken from your bank account on the wrong day or for the wrong amount": "Fraud, scams, or unauthorized activity",
    "Unauthorized transactions/trans. issues": "Fraud, scams, or unauthorized activity",
    "Identity theft / Fraud / Embezzlement": "Fraud, scams, or unauthorized activity",
    "Can't stop charges to bank account": "Fraud, scams, or unauthorized activity",
    "Received a loan you didn't apply for": "Fraud, scams, or unauthorized activity",
    "Received a loan I didn't apply for": "Fraud, scams, or unauthorized activity",
    "Charged bank acct wrong day or amt": "Fraud, scams, or unauthorized activity",
    # Advertising, disclosures, or promised services
    "Advertising and marketing, including promotional offers": "Advertising, disclosures, or promised services",
    "Didn't provide services promised": "Advertising, disclosures, or promised services",
    "Confusing or missing disclosures": "Advertising, disclosures, or promised services",
    "Confusing or misleading advertising or marketing": "Advertising, disclosures, or promised services",
    "Advertising": "Advertising, disclosures, or promised services",
    "Advertising and marketing": "Advertising, disclosures, or promised services",
    "Disclosures": "Advertising, disclosures, or promised services",
    "Incorrect/missing disclosures or info": "Advertising, disclosures, or promised services",
    "Advertising, marketing or disclosures": "Advertising, disclosures, or promised services",
    # Customer service or company investigation
    "Problem with a company's investigation into an existing problem": "Customer service or company investigation",
    "Problem with a company's investigation into an existing issue": "Customer service or company investigation",
    "Problem with customer service": "Customer service or company investigation",
    "Other service problem": "Customer service or company investigation",
    "Customer service / Customer relations": "Customer service or company investigation",
    "Customer service/Customer relations": "Customer service or company investigation",
    "Other service issues": "Customer service or company investigation",
    # Funds availability, deposits, or adding money
    "Money was not available when promised": "Funds availability, deposits, or adding money",
    "Problem adding money": "Funds availability, deposits, or adding money",
    "Adding money": "Funds availability, deposits, or adding money",
    # Overdraft, low funds, or related features
    "Problem caused by your funds being low": "Overdraft, low funds, or related features",
    "Overdraft, savings, or rewards features": "Overdraft, low funds, or related features",
    "Problem with overdraft": "Overdraft, low funds, or related features",
    "Problem with an overdraft": "Overdraft, low funds, or related features",
    "Problems caused by my funds being low": "Overdraft, low funds, or related features",
    "Overdraft, savings or rewards features": "Overdraft, low funds, or related features",
    # Mobile wallet account or fund access
    "Managing, opening, or closing your mobile wallet account": "Mobile wallet account or fund access",
    "Trouble accessing funds in your mobile or digital wallet": "Mobile wallet account or fund access",
    # Card features, terms, add-ons, or rewards
    "Problem with additional add-on products or services": "Card features, terms, add-ons, or rewards",
    "Other features, terms, or problems": "Card features, terms, add-ons, or rewards",
    "Problem with cash advance": "Card features, terms, add-ons, or rewards",
    "Credit card protection / Debt protection": "Card features, terms, add-ons, or rewards",
    "Sale of account": "Card features, terms, add-ons, or rewards",
    "Rewards": "Card features, terms, add-ons, or rewards",
    "Arbitration": "Card features, terms, add-ons, or rewards",
    "Account terms and changes": "Card features, terms, add-ons, or rewards",
    "Convenience checks": "Card features, terms, add-ons, or rewards",
    "Balance transfer": "Card features, terms, add-ons, or rewards",
    "Privacy": "Card features, terms, add-ons, or rewards",
    "Cash advance": "Card features, terms, add-ons, or rewards",
    # Special loan terms or arrangements
    "Issue with income share agreement": "Special loan terms or arrangements",
    "Issue where my lender is my school": "Special loan terms or arrangements",
    # General or other
    "General": "General or other",
    "General issues": "General or other",
    "Other": "General or other",
}

# Company response to consumer: collapsed into relief/outcome buckets.
# Values not listed are left untouched.
COMPANY_RESPONSE_GROUPS = {
    "Closed with monetary relief": "Closed - With relief",
    "Closed with non-monetary relief": "Closed - With relief",
    "Closed with relief": "Closed - With relief",
    "Closed without relief": "Closed - Without relief",
    "Closed with explanation": "Closed - Without relief",
    "Closed": "Closed - Unspecified",
    "In progress": "In progress",
    "Untimely response": "Untimely response",
}

TIMELY_RESPONSE_MAP = {"Yes": True, "No": False}


def read_raw() -> DataFrame:
    """Read the landed CSV.

    multiLine=True is non-negotiable: consumer narratives contain embedded newlines
    and are RFC4180-quoted. The cost is that Spark cannot split the file, so the
    initial read is single-threaded — hence the repartition immediately after.
    """
    df = (
        spark.read.format("csv")
        .option("header", "true")
        .option("multiLine", "true")
        .option("quote", '"')
        .option("escape", '"')
        .option("mode", "PERMISSIVE")
        .option("columnNameOfCorruptRecord", "_corrupt_record")
        .schema(RAW_SCHEMA)
        .load(RAW_S3_URI)
    )
    return df.repartition(400)


def _distinct_bad_values(df: DataFrame, column: str, is_bad) -> list:
    return (
        df.filter(F.col(column).isNotNull() & is_bad)
        .select(column)
        .distinct()
        .limit(5)
        .rdd.flatMap(lambda row: row)
        .collect()
    )


def strict_complaint_id_to_long(df: DataFrame) -> DataFrame:
    """Cast complaint_id to long, raising if any value isn't a clean integer.

    A silently-null complaint_id would make its row invisible to the Iceberg
    MERGE key, so a bad ID has to be a hard failure, not a dropped row.
    """
    as_long = F.col("complaint_id").cast("long")
    is_bad = as_long.cast("double") != F.col("complaint_id").cast("double")
    bad_values = _distinct_bad_values(df, "complaint_id", is_bad)
    if bad_values:
        raise ValueError(f"Cannot convert values in 'complaint_id' to long: {bad_values}")
    return df.withColumn("complaint_id", as_long)


def parse_mixed_iso8601(df: DataFrame, column: str) -> DataFrame:
    """Parse a column of mixed ISO 8601 strings to a date, raising on any value
    that matches neither the timestamp nor the date-only form.

    A silently-null date_received would both drop the row later and make a
    genuine upstream schema change invisible, so bad input is a hard failure.
    """
    parsed = F.coalesce(
        F.to_timestamp(F.col(column), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
        F.to_timestamp(F.col(column), "yyyy-MM-dd"),
    )
    bad_values = _distinct_bad_values(df, column, parsed.isNull())
    if bad_values:
        raise ValueError(f"Cannot parse values in {column!r}: {bad_values}")
    return df.withColumn(column, parsed.cast("date"))


def group_sub_product(df: DataFrame) -> DataFrame:
    return df.replace(SUB_PRODUCT_ALIASES, subset=[SUB_PRODUCT_COL])


def group_issue(df: DataFrame) -> DataFrame:
    df = df.replace(ISSUE_GROUPS, subset=[ISSUE_COL])
    return df.withColumn(ISSUE_COL, F.coalesce(F.col(ISSUE_COL), F.lit("Unknown")))


def group_company_response(df: DataFrame) -> DataFrame:
    return df.replace(COMPANY_RESPONSE_GROUPS, subset=[COMPANY_RESPONSE_COL])


def boolify_timely_response(df: DataFrame) -> DataFrame:
    """Yes/No -> boolean, raising on any other non-null value.

    This column has a closed set of valid values per the CFPB field spec, so
    an unexpected value means the source format drifted and deserves a loud
    failure rather than a silent NULL.
    """
    is_bad = ~F.col(TIMELY_RESPONSE_COL).isin(list(TIMELY_RESPONSE_MAP))
    invalid_values = _distinct_bad_values(df, TIMELY_RESPONSE_COL, is_bad)
    if invalid_values:
        raise ValueError(f"Unexpected values in {TIMELY_RESPONSE_COL!r}: {invalid_values}")

    mapping = F.create_map([F.lit(x) for pair in TIMELY_RESPONSE_MAP.items() for x in pair])
    return df.withColumn(f"{TIMELY_RESPONSE_COL}_flag", mapping[F.col(TIMELY_RESPONSE_COL)])


def transform(df: DataFrame) -> DataFrame:
    ingest_ts = datetime.now(timezone.utc)

    # Validate and normalize while columns are still raw strings, matching the
    # per-column rules from cfpb_complaints_standardize.py / cfpb.ipynb.
    df = strict_complaint_id_to_long(df)
    df = parse_mixed_iso8601(df, "date_received")
    df = parse_mixed_iso8601(df, "date_sent_to_company")
    df = group_sub_product(df)
    df = group_issue(df)
    df = group_company_response(df)

    shaped = df.select(
        F.col("complaint_id"),
        F.col("date_received"),
        F.col("date_sent_to_company"),
        *[
            F.trim(F.col(c)).alias(c)
            for c in COLUMN_MAP.values()
            if c not in ("complaint_id", "date_received", "date_sent_to_company")
        ],
    )

    shaped = boolify_timely_response(shaped)

    shaped = shaped.withColumn("has_narrative", F.col("consumer_complaint_narrative").isNotNull())

    # Content hash over the business columns. NULL-safe via coalesce so a field
    # flipping between NULL and "" doesn't register as spurious drift.
    hash_input = F.concat_ws("||", *[F.coalesce(F.col(c).cast("string"), F.lit("")) for c in HASH_COLUMNS])
    shaped = (
        shaped.withColumn("record_hash", F.sha2(hash_input, 256))
        .withColumn("ingest_ts", F.lit(ingest_ts).cast("timestamp"))
        .withColumn("source_file", F.lit(RAW_S3_URI))
    )

    # Drop unusable rows and collapse any duplicate complaint_id. Iceberg MERGE
    # aborts if a single target row matches multiple source rows, so this is a
    # correctness requirement, not just hygiene.
    shaped = shaped.filter(F.col("complaint_id").isNotNull() & F.col("date_received").isNotNull())
    window = Window.partitionBy("complaint_id").orderBy(F.col("date_sent_to_company").desc_nulls_last())
    return (
        shaped.withColumn("_rn", F.row_number().over(window))
        .filter(F.col("_rn") == 1)
        .drop("_rn")
    )


# ---------------------------------------------------------------------------
# 5. Target table
# ---------------------------------------------------------------------------


def table_exists() -> bool:
    return spark.catalog.tableExists(FQTN)


def create_table(source: DataFrame) -> None:
    """Create the Iceberg table using the source schema, with hidden partitioning.

    months(date_received) yields ~180 partitions across the 2011-present range,
    which keeps file counts reasonable without over-fragmenting recent months.
    """
    log.info("Creating %s", FQTN)
    source.limit(0).createOrReplaceTempView("cfpb_schema_seed")
    spark.sql(
        f"""
        CREATE TABLE {FQTN}
        USING iceberg
        PARTITIONED BY (months(date_received))
        TBLPROPERTIES (
            'format-version' = '2',
            'write.format.default' = 'parquet',
            'write.parquet.compression-codec' = 'zstd',
            'write.distribution-mode' = 'hash',
            'write.target-file-size-bytes' = '268435456',
            'write.metadata.delete-after-commit.enabled' = 'true',
            'write.metadata.previous-versions-max' = '20'
        )
        AS SELECT * FROM cfpb_schema_seed
        """
    )
    spark.sql(f"ALTER TABLE {FQTN} WRITE ORDERED BY date_received, complaint_id")


# ---------------------------------------------------------------------------
# 6. Upsert
# ---------------------------------------------------------------------------


def bootstrap_load(source: DataFrame) -> None:
    log.info("Empty target — writing initial snapshot.")
    source.writeTo(FQTN).append()


def merge_load(source: DataFrame) -> None:
    source.createOrReplaceTempView("cfpb_source")

    predicate = "t.complaint_id = s.complaint_id"
    if MERGE_WINDOW_DAYS:
        cutoff = (date.today() - timedelta(days=MERGE_WINDOW_DAYS)).isoformat()
        # Prunes partitions on the target side. Late updates to complaints received
        # before the cutoff will NOT be applied — deliberate speed/completeness trade.
        predicate += f" AND t.date_received >= DATE '{cutoff}'"
        source = source.filter(F.col("date_received") >= F.lit(cutoff))
        source.createOrReplaceTempView("cfpb_source")
        log.info("Merge window active: only complaints received on/after %s.", cutoff)

    columns = [c for c in source.columns]
    update_set = ", ".join(f"t.{c} = s.{c}" for c in columns)
    insert_cols = ", ".join(columns)
    insert_vals = ", ".join(f"s.{c}" for c in columns)

    # The record_hash guard is what makes a daily full-file merge affordable:
    # rows whose content is unchanged produce no write and no file rewrite.
    spark.sql(
        f"""
        MERGE INTO {FQTN} t
        USING cfpb_source s
          ON {predicate}
        WHEN MATCHED AND t.record_hash <> s.record_hash THEN
          UPDATE SET {update_set}
        WHEN NOT MATCHED THEN
          INSERT ({insert_cols}) VALUES ({insert_vals})
        """
    )


def maintenance() -> None:
    """Compact small files and expire old snapshots so the table doesn't rot."""
    try:
        spark.sql(
            f"CALL {CATALOG}.system.rewrite_data_files("
            f"table => '{DATABASE}.{TABLE}', "
            f"options => map('min-input-files', '10', 'target-file-size-bytes', '268435456'))"
        )
        expire_before = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S")
        spark.sql(
            f"CALL {CATALOG}.system.expire_snapshots("
            f"table => '{DATABASE}.{TABLE}', older_than => TIMESTAMP '{expire_before}', retain_last => 5)"
        )
        spark.sql(
            f"CALL {CATALOG}.system.remove_orphan_files(table => '{DATABASE}.{TABLE}')"
        )
    except Exception as exc:  # maintenance failure must not fail the load
        log.warning("Table maintenance skipped: %s", exc)


# ---------------------------------------------------------------------------
# 7. Main
# ---------------------------------------------------------------------------


def main() -> None:
    land_raw_csv()

    source = transform(read_raw()).cache()
    row_count = source.count()
    log.info("Source rows after dedupe: %s", f"{row_count:,}")

    if row_count == 0:
        raise RuntimeError("Source produced zero rows — refusing to touch the target table.")

    if not table_exists():
        create_table(source)
        bootstrap_load(source)
    else:
        merge_load(source)

    total = spark.sql(f"SELECT COUNT(*) AS c FROM {FQTN}").collect()[0]["c"]
    log.info("Target row count: %s", f"{total:,}")

    maintenance()
    source.unpersist()
    job.commit()


if __name__ == "__main__":
    main()