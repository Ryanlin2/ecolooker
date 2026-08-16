# sqgdp-main-metrics-endpoint

Deploys `bea/lambda/sqgdp_main_metrics.py` as a Lambda function that queries
the Athena views in `bea/athena/sqgdp_views.sql`, assembles a columnar JSON
payload, and writes it (gzipped) to
`s3://ecolooker-bea/gold/endpoints/sqgdp-main-metrics/datasets.json.gz` --
the "gold" endpoint the `us-industry-gdp` dashboard reads. Same shape as the
existing `cfpb/lambda/cfpb_mega.py` endpoint.

## What it does

On invocation (via the Function URL, `GET /?dataset=...&limit=...`):

1. Runs one Athena query per requested dataset (default: all three) against
   the Glue Catalog `bea` database:
   - `national_gdp` -- `bea.v_us_national_gdp`
   - `state_gdp` -- `bea.v_us_state_gdp`
   - `industry_gdp` -- `bea.v_us_industry_gdp`
2. Converts each result set into a `{fields, data}` columnar block (positional
   row arrays, typed/rounded values) with `date_field`/`start`/`end` bounds.
3. Gzips the combined `{schema_version, generated_at, datasets}` payload and
   `PutObject`s it to `RESULTS_KEY`, overwriting any prior version.
4. Returns write metadata (S3 location, byte counts, version id) as the HTTP
   response -- **not** the payload itself. The website should read the gold
   S3 object directly (via CloudFront or similar), not this Function URL, for
   serving data -- this endpoint's job is to refresh that object.

## What it creates

- **Lambda function** (`sqgdp-main-metrics-endpoint`) -- Python 3.13,
  256 MB, 60s timeout (Athena polling takes a few seconds per dataset).
- **Lambda Function URL** -- public HTTPS endpoint, `authorization_type =
  "NONE"` (no auth; the Lambda code sets CORS headers itself via
  `ALLOWED_ORIGIN`).
- **IAM role** (`lambda-sqgdp-main-metrics-role`) -- scoped to: CloudWatch
  Logs (`AWSLambdaBasicExecutionRole`); `athena:{Start,Get,Stop}*Query*` on
  the `primary` workgroup; `glue:Get{Database,Table,Tables,Partition,
  Partitions}` on the `bea` database/tables (covers the views and the
  underlying `sqgdp_state_gdp` Iceberg table they query); `s3:GetObject` on
  `silver/sqgdp/*` (Iceberg data Athena scans); `s3:{Get,Put}Object` on
  `athena-results/sqgdp-main-metrics/*` (Athena's query result/staging
  location) and on `gold/endpoints/sqgdp-main-metrics/*` (the payload this
  Lambda writes).

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.6.0
- AWS credentials available to the AWS provider
- The `ecolooker-bea` S3 bucket must already exist
- The Athena `primary` workgroup must already exist (or pass
  `-var="athena_workgroup=..."` for one that does)
- The views in `bea/athena/sqgdp_views.sql` must already be created in the
  `bea` Glue Catalog database (run that script against Athena first) and the
  `bea.sqgdp_state_gdp` Iceberg table must have data (run
  `standardize-sqgdp` first)
- Permissions to create IAM roles/policies and Lambda functions

## Run it

From this directory (`bea/terraform/actions/sqgdp-main-metrics-endpoint`):

```bash
terraform init
terraform plan
terraform apply
```

## Trigger a refresh

```bash
curl "$(terraform output -raw lambda_url)"
```

Or scope to specific datasets / row limits:

```bash
curl "$(terraform output -raw lambda_url)?dataset=national_gdp,industry_gdp&limit=200"
```

Confirm the gold object landed:

```bash
aws s3 ls "s3://ecolooker-bea/gold/endpoints/sqgdp-main-metrics/"
```

## Tear it down

This endpoint is public and unauthenticated -- anyone with the URL can
trigger Athena queries and overwrite the gold object, so don't leave it
running longer than needed without adding auth/throttling in front of it.

```bash
terraform destroy
```

## Notes / known limitations

- No auth, rate limiting, or reserved concurrency on the Function URL --
  each invocation runs real Athena queries. Put this behind a scheduled
  trigger (`aws_scheduler_schedule`, e.g. after `standardize-sqgdp` runs) or
  an authenticated API Gateway route before treating it as production.
- No CloudFront/API Gateway distribution for the gold object itself is
  created here -- that's a separate stack. The website's `CFPB_API_URL`-style
  env var for this dashboard should point at whatever serves
  `gold/endpoints/sqgdp-main-metrics/datasets.json.gz`, not at
  `lambda_url`.
- State is local (`terraform.tfstate` in this directory, gitignored here) --
  not a remote backend.
