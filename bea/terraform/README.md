# bea/terraform

Terraform stacks for the BEA SQGDP pipeline's AWS infrastructure. Each
subfolder under `actions/` is an independent stack (own state, own `terraform
init`/`apply`/`destroy`) deploying one job or Lambda from
[`bea/glue`](../glue) or [`bea/lambda`](../lambda). Apply them in pipeline
order — each stack's README documents its own prerequisites.

| Stack | Deploys | Order |
|---|---|---|
| [`actions/sqgdp_full_download`](actions/sqgdp_full_download) | `bea/glue/sqgdp_download_to_s3.py` as a Glue Python Shell job — pulls the BEA SQGDP zip into `s3://ecolooker-bea/bronze/sqgdp/` | 1 |
| [`actions/standardize-sqgdp`](actions/standardize-sqgdp) | `bea/glue/sqgdp_iceberg_job.py` as a Glue Spark ETL job — standardizes the latest bronze drop into the `bea.sqgdp_state_gdp` Iceberg table under `s3://ecolooker-bea/silver/sqgdp/` | 2 (after at least one download run) |
| [`actions/sqgdp-main-metrics-endpoint`](actions/sqgdp-main-metrics-endpoint) | `bea/lambda/sqgdp_main_metrics.py` as a public Lambda Function URL — queries the Athena views, writes the gold JSON payload | 3 (after the Athena views in `bea/athena/sqgdp_views.sql` exist and Iceberg has data) |
| [`actions/sqgdp-main-metrics-reader`](actions/sqgdp-main-metrics-reader) | `bea/lambda/sqgdp_main_metrics_reader.py` as a public Lambda Function URL — serves the gold JSON payload written above | 4 (after the endpoint stack has run at least once) |
| [`lambda-s3-demo`](lambda-s3-demo) | A standalone "receive a GET, write a record to S3" Lambda + Function URL | unrelated — a demo/scratch stack, not part of the SQGDP pipeline |

All four `actions/*` stacks reference a pre-existing `ecolooker-bea` S3
bucket via a data source rather than creating it, use local Terraform state
(`terraform.tfstate` in each directory, gitignored), and create their own
scoped IAM role rather than sharing one. None of them wire up a schedule or
trigger — jobs/Lambdas are deployed but must be invoked manually (`aws glue
start-job-run`, `curl "$(terraform output -raw lambda_url)"`) or scheduled
separately (e.g. `aws_scheduler_schedule`, `aws_glue_trigger`).

`lambda-s3-demo` predates the SQGDP pipeline and isn't referenced by it —
treat it as a standalone example/learning stack for the Lambda + S3 pattern,
not something to deploy alongside the others.
