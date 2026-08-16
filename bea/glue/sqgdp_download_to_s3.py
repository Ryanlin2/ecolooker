"""
AWS Glue Python Shell job: download the BEA SQGDP.zip export and land its
CSVs in S3 as the raw landing zone for sqgdp_iceberg_job.py.

Same logic as the "Download" cell in sqgdp_data/sqgdp.ipynb, wired up to
write to S3 instead of a local folder. This is a Python Shell job,
not a Spark ETL job -- a zip download + a few dozen S3 PutObjects doesn't
need a Spark cluster, and Python Shell jobs start in seconds and bill by
the second at a fraction of the cost.

Every run lands under its own ingestion_date=<UTC timestamp> partition
(date AND time, to the second) under S3_PREFIX, so re-running the job
(e.g. after a BEA data refresh) never overwrites a prior pull and the
raw landing zone keeps a full history of what was ingested when.

--- Job configuration (set these on the Glue job, not in this script) ---
Job type:      Python Shell
Python version: 3.9
Max capacity:  0.0625 DPU (smallest tier; this job is single-threaded I/O)
Job parameters:
  --ZIP_URL     https://apps.bea.gov/regional/zip/SQGDP.zip
  --S3_BUCKET   <bucket>
  --S3_PREFIX   bea/sqgdp_data/raw/
Set ZIP_URL as a default job parameter in the job definition (Terraform
`default_arguments` / console "Job parameters") so job runs don't need to
pass it explicitly.
IAM: s3:PutObject on s3://<bucket>/<S3_PREFIX>*
Network: no VPC attachment needed -- Python Shell jobs run with internet
         access by default, which this job requires to reach apps.bea.gov.
---------------------------------------------------------------------
"""

import sys
import zipfile
from datetime import datetime, timezone
from io import BytesIO
from urllib.request import urlopen

import boto3
from awsglue.utils import getResolvedOptions

args = getResolvedOptions(
    sys.argv,
    ["JOB_NAME", "ZIP_URL", "S3_BUCKET", "S3_PREFIX"],
)

s3 = boto3.client("s3")


def fetch_zip(url: str) -> zipfile.ZipFile:
    print(f"Downloading {url}")
    with urlopen(url) as response:
        return zipfile.ZipFile(BytesIO(response.read()))


def ingestion_prefix(base_prefix: str) -> str:
    """base_prefix + a Hive-style ingestion_date=<UTC timestamp> partition,
    exact to the second, so every job run gets its own destination."""
    ingestion_date = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    return f"{base_prefix.rstrip('/')}/ingestion_date={ingestion_date}/"


def upload_csvs(zip_file: zipfile.ZipFile, bucket: str, prefix: str) -> int:
    count = 0
    for file_info in zip_file.infolist():
        name = file_info.filename
        if not name.endswith(".csv") or name.startswith("__MACOSX"):
            continue

        key = f"{prefix}{name}"
        print(f"Uploading: {name} -> s3://{bucket}/{key}")
        s3.put_object(
            Bucket=bucket,
            Key=key,
            Body=zip_file.read(file_info),
            ContentType="text/csv",
        )
        count += 1
    return count


def main():
    zip_file = fetch_zip(args["ZIP_URL"])
    prefix = ingestion_prefix(args["S3_PREFIX"])
    uploaded = upload_csvs(zip_file, args["S3_BUCKET"], prefix)
    print(f"Uploaded {uploaded} CSV files to s3://{args['S3_BUCKET']}/{prefix}")


if __name__ == "__main__":
    main()
