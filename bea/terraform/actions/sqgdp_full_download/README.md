# sqgdp_full_download

Deploys the `bea/glue/sqgdp_download_to_s3.py` script as an AWS Glue Python Shell
job that downloads the BEA `SQGDP.zip` export and lands its CSVs in S3.

## What it creates

- **Glue job** (`aws_glue_job.sqgdp_full_download`) — Python Shell, Python 3.9,
  0.0625 DPU (smallest tier; the job is single-threaded I/O, not Spark).
  Job parameters `--ZIP_URL`, `--S3_BUCKET`, `--S3_PREFIX` are set as
  `default_arguments` so runs don't need to pass them explicitly.
- **S3 object** (`aws_s3_object.glue_script`) — uploads the local script to
  `s3://ecolooker-bea/scripts/glue/sqgdp_download_to_s3.py` so Glue can run it.
- **IAM role** (`glue-sqgdp-full-download-role`) — scoped to: CloudWatch Logs
  under `/aws-glue/*`, `s3:GetObject` on the uploaded script, and
  `s3:PutObject` on `s3://ecolooker-bea/bronze/sqgdp/*` only.

## Output layout

Each run lands under its own timestamped partition:

```
s3://ecolooker-bea/bronze/sqgdp/ingestion_date=<UTC timestamp>/*.csv
```

The timestamp partition (`ingestion_date=YYYYMMDDTHHMMSSZ`) comes from the
script itself (`sqgdp_download_to_s3.py`), not from Terraform -- this is the
"ingestion timestamp" partitioning. If you want the partition key literally
named `ingestion_timestamp=` instead of `ingestion_date=`, that requires a
one-line change in the script (`ingestion_prefix()`), not this stack.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.6.0
- AWS credentials available to the AWS provider
- The `ecolooker-bea` S3 bucket must already exist (this stack references it
  via a data source and does not create or manage it)
- Permissions to create IAM roles/policies, Glue jobs, and put objects into
  `ecolooker-bea`

## Run it

From this directory (`bea/terraform/actions/sqgdp_full_download`):

```bash
terraform init
terraform plan
terraform apply
```

To target a different bucket, prefix, or region:

```bash
terraform apply -var="output_bucket=my-bucket" -var="output_prefix=bronze/sqgdp/" -var="aws_region=us-east-2"
```

## Run the job

```bash
aws glue start-job-run --job-name "$(terraform output -raw glue_job_name)"
```

Check status:

```bash
aws glue get-job-runs --job-name "$(terraform output -raw glue_job_name)" --max-results 1
```

## Tear it down

```bash
terraform destroy
```

This removes the Glue job, IAM role/policy, and the uploaded script object.
It does **not** delete any data already landed under `bronze/sqgdp/`, and does
not touch the `ecolooker-bea` bucket itself.

## Notes / known limitations

- No trigger/schedule is created -- this only defines the job. Wire up an
  `aws_glue_trigger` (on-demand, scheduled, or event-based) separately if you
  want it to run automatically.
- State is local (`terraform.tfstate` in this directory), not a remote
  backend -- don't commit `terraform.tfstate` or `.terraform/` to git.
