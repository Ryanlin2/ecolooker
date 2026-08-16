# standardize-sqgdp

Deploys the `bea/glue/sqgdp_iceberg_job.py` script as an AWS Glue Spark ETL
job that standardizes the latest bronze SQGDP CSV drop into the
`sqgdp_state_gdp` Apache Iceberg table.

## What it does

On each run, the job:

1. Lists `s3://ecolooker-bea/bronze/sqgdp/` for `ingestion_date=<UTC timestamp>`
   partitions (one per `sqgdp_full_download` run) and picks whichever sorts
   last -- i.e. the most recent ingestion.
2. Reads that partition's `SQGDP{table}__ALL_AREAS_*.csv` files, unpivots
   the `YYYY:Qn` columns into long rows, and standardizes/casts them.
3. `MERGE`s the result into the `bea.sqgdp_state_gdp` Iceberg table (upsert
   on `table_name, geo_fips, line_code, period_date`, since BEA restates
   prior quarters on every refresh) via the Glue Data Catalog, landing data
   under `s3://ecolooker-bea/silver/sqgdp/`.

The partition discovery happens inside the script itself (via boto3), not
in Terraform -- so re-running the job later automatically picks up whatever
the most recent bronze drop is at that time, no redeploy needed.

## What it creates

- **Glue job** (`aws_glue_job.standardize_sqgdp`) -- Spark ETL (`glueetl`),
  Glue 4.0+ (required for native Iceberg support), `G.1X` workers. Job
  parameters (`--RAW_S3_BUCKET`, `--RAW_S3_PREFIX`, `--ICEBERG_DATABASE`,
  `--ICEBERG_TABLE`, Iceberg `--conf`/`--datalake-formats`) are set as
  `default_arguments` so runs don't need to pass them explicitly.
- **Glue Catalog database** (`aws_glue_catalog_database.bea`) -- the `bea`
  database the Iceberg table is registered under.
- **S3 object** (`aws_s3_object.glue_script`) -- uploads the local script to
  `s3://ecolooker-bea/scripts/glue/sqgdp_iceberg_job.py`.
- **IAM role** (`glue-standardize-sqgdp-role`) -- scoped to: CloudWatch Logs
  under `/aws-glue/*`; `s3:GetObject` on the uploaded script;
  `s3:ListBucket` on `ecolooker-bea` scoped to the `bronze/sqgdp/` and
  `silver/sqgdp/` prefixes; `s3:GetObject` under `bronze/sqgdp/`;
  `s3:{Get,Put,Delete}Object` under `silver/sqgdp/` (Iceberg rewrites/deletes
  data files on merge/compaction, not just appends); and
  `glue:*Table`/`glue:*Database`/`glue:*Partition` actions scoped to the
  `bea` database and `sqgdp_state_gdp` table.

## Output layout

```
s3://ecolooker-bea/silver/sqgdp/bea.db/sqgdp_state_gdp/
```

(Iceberg lays out data + metadata files under `<warehouse>/<database>.db/<table>/`
itself; the Glue Catalog table entry points at this location.)

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.6.0
- AWS credentials available to the AWS provider
- The `ecolooker-bea` S3 bucket must already exist (this stack references it
  via a data source and does not create or manage it)
- At least one `ingestion_date=` partition must already exist under
  `bronze/sqgdp/` (run `sqgdp_full_download` first) -- the job errors out if
  none are found
- Permissions to create IAM roles/policies, Glue jobs/databases, and
  read/write objects in `ecolooker-bea`

## Run it

From this directory (`bea/terraform/actions/standardize-sqgdp`):

```bash
terraform init
terraform plan
terraform apply
```

To target a different bucket, prefixes, or region:

```bash
terraform apply -var="bucket=my-bucket" -var="bronze_prefix=bronze/sqgdp/" -var="silver_prefix=silver/sqgdp/" -var="aws_region=us-east-2"
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

This removes the Glue job, IAM role/policy, the Glue Catalog database, and
the uploaded script object. It does **not** delete any data already landed
under `bronze/sqgdp/` or `silver/sqgdp/`, and does not touch the
`ecolooker-bea` bucket itself.

## Notes / known limitations

- No trigger/schedule is created -- this only defines the job. Wire up an
  `aws_glue_trigger` (on-demand, scheduled, or event-based off the
  `sqgdp_full_download` job completing) separately if you want it to run
  automatically after each new bronze drop.
- State is local (`terraform.tfstate` in this directory, gitignored here) --
  not a remote backend.
