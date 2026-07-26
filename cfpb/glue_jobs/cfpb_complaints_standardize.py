"""AWS Glue ETL job for cleaning the CFPB consumer complaints dataset.

Implements the per-column solutions decided in cfpb/data/cfpb.ipynb:
  - Complaint ID:              flag missing IDs, keep duplicates; cast to long
  - Date received:              parse mixed ISO 8601 (date-only -> midnight UTC)
  - Sub-product:                collapse known aliases to a canonical name
  - Issue:                      collapse into higher-level issue groups
  - Company response to consumer: collapse into relief/outcome buckets
  - Timely response?:           map Yes/No -> boolean, fail on unexpected values
  - Product, Sub-issue, Consumer complaint narrative, Company public response,
    Company, State, ZIP code, Tags, Submitted via: left unchanged (no
    consolidation was finalized in the notebook for these columns)

Job parameters:
  --INPUT_PATH   S3 (or DBFS/local) path to the raw complaints CSV
  --OUTPUT_PATH  S3 path to write the cleaned dataset as Parquet
"""

import sys

from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql import DataFrame
from pyspark.sql import functions as F
from pyspark.sql.types import LongType

COMPLAINT_ID_COL = "Complaint ID"
DATE_RECEIVED_COL = "Date received"
DATE_SENT_TO_COMPANY_COL = "Date sent to company"
SUB_PRODUCT_COL = "Sub-product"
ISSUE_COL = "Issue"
COMPANY_RESPONSE_COL = "Company response to consumer"
TIMELY_RESPONSE_COL = "Timely response?"

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


def read_complaints(spark, path: str) -> DataFrame:
    return (
        spark.read.option("header", True)
        .option("multiLine", True)
        .option("escape", '"')
        .csv(path)
    )


def parse_mixed_iso8601(df: DataFrame, column: str) -> DataFrame:
    """Parse a column of mixed ISO 8601 strings to a UTC timestamp.

    Date-only values ("yyyy-MM-dd") are interpreted as midnight UTC. Raises
    if any non-null value fails to parse under either format.
    """
    parsed = F.coalesce(
        F.to_timestamp(F.col(column), "yyyy-MM-dd'T'HH:mm:ss.SSS'Z'"),
        F.to_timestamp(F.col(column), "yyyy-MM-dd"),
    )

    bad_values = (
        df.filter(F.col(column).isNotNull() & parsed.isNull())
        .select(column)
        .distinct()
        .limit(5)
        .rdd.flatMap(lambda row: row)
        .collect()
    )
    if bad_values:
        raise ValueError(f"Cannot parse values in {column!r}: {bad_values}")

    return df.withColumn(column, parsed)


def flag_missing_complaint_id(df: DataFrame) -> DataFrame:
    return df.withColumn(
        "Missing Complaint ID", F.col(COMPLAINT_ID_COL).isNull()
    )


def group_sub_product(df: DataFrame) -> DataFrame:
    return df.replace(SUB_PRODUCT_ALIASES, subset=[SUB_PRODUCT_COL])


def group_issue(df: DataFrame) -> DataFrame:
    df = df.replace(ISSUE_GROUPS, subset=[ISSUE_COL])
    return df.withColumn(ISSUE_COL, F.coalesce(F.col(ISSUE_COL), F.lit("Unknown")))


def group_company_response(df: DataFrame) -> DataFrame:
    return df.replace(COMPANY_RESPONSE_GROUPS, subset=[COMPANY_RESPONSE_COL])


def boolify_timely_response(df: DataFrame) -> DataFrame:
    invalid_values = (
        df.filter(
            F.col(TIMELY_RESPONSE_COL).isNotNull()
            & ~F.col(TIMELY_RESPONSE_COL).isin(list(TIMELY_RESPONSE_MAP))
        )
        .select(TIMELY_RESPONSE_COL)
        .distinct()
        .limit(5)
        .rdd.flatMap(lambda row: row)
        .collect()
    )
    if invalid_values:
        raise ValueError(
            f"Unexpected values in {TIMELY_RESPONSE_COL!r}: {invalid_values}"
        )

    mapping = F.create_map([F.lit(x) for pair in TIMELY_RESPONSE_MAP.items() for x in pair])
    return df.withColumn(TIMELY_RESPONSE_COL, mapping[F.col(TIMELY_RESPONSE_COL)])


def strict_complaint_id_to_long(df: DataFrame) -> DataFrame:
    as_long = F.col(COMPLAINT_ID_COL).cast(LongType())

    bad_values = (
        df.filter(
            F.col(COMPLAINT_ID_COL).isNotNull()
            & (as_long.cast("double") != F.col(COMPLAINT_ID_COL).cast("double"))
        )
        .select(COMPLAINT_ID_COL)
        .distinct()
        .limit(5)
        .rdd.flatMap(lambda row: row)
        .collect()
    )
    if bad_values:
        raise ValueError(f"Cannot convert values in {COMPLAINT_ID_COL!r} to int: {bad_values}")

    return df.withColumn(COMPLAINT_ID_COL, as_long)


def clean_complaints(df: DataFrame) -> DataFrame:
    df = flag_missing_complaint_id(df)
    df = parse_mixed_iso8601(df, DATE_RECEIVED_COL)
    df = parse_mixed_iso8601(df, DATE_SENT_TO_COMPANY_COL)
    df = group_sub_product(df)
    df = group_issue(df)
    df = group_company_response(df)
    df = boolify_timely_response(df)
    df = strict_complaint_id_to_long(df)
    return df


def main():
    args = getResolvedOptions(sys.argv, ["JOB_NAME", "INPUT_PATH", "OUTPUT_PATH"])

    sc = SparkContext()
    glue_context = GlueContext(sc)
    spark = glue_context.spark_session
    job = Job(glue_context)
    job.init(args["JOB_NAME"], args)

    df = read_complaints(spark, args["INPUT_PATH"])
    cleaned = clean_complaints(df)
    cleaned.write.mode("overwrite").parquet(args["OUTPUT_PATH"])

    job.commit()


if __name__ == "__main__":
    main()
