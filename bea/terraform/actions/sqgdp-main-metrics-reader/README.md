# sqgdp-main-metrics-reader

Deploys `bea/lambda/sqgdp_main_metrics_reader.py` as a Lambda function that
reads the gold JSON payload at
`s3://ecolooker-bea/gold/endpoints/sqgdp-main-metrics/datasets.json.gz` and
serves it to any client that hits its Function URL. This is the "read" half
of the endpoint; `sqgdp-main-metrics-endpoint` (a separate stack) is the
"write" half that queries Athena and refreshes that object.

## What it does

On every request (`GET` on the Function URL):

1. `GetObject`s the configured `RESULTS_KEY`.
2. Streams the bytes straight through, including `Content-Encoding: gzip` --
   no server-side decompression, so this stays fast and cheap regardless of
   payload size. Clients (browsers, `fetch()`, `curl --compressed`) handle
   gzip decoding transparently.
3. Returns `404` if the object doesn't exist yet (writer hasn't run), or
   `502` on any other S3 read failure.

`OPTIONS` requests get a bare CORS preflight response.

## What it creates

- **Lambda function** (`sqgdp-main-metrics-reader`) -- Python 3.13, 128 MB,
  10s timeout.
- **Lambda Function URL** -- public HTTPS endpoint, `authorization_type =
  "NONE"` (no auth; the Lambda code sets CORS headers itself via
  `ALLOWED_ORIGIN`).
- **IAM role** (`lambda-sqgdp-main-metrics-reader-role`) -- scoped to:
  CloudWatch Logs (`AWSLambdaBasicExecutionRole`) and `s3:GetObject` on
  exactly `RESULTS_KEY` (no list/write access, no Athena/Glue access --
  this function only ever reads one object).

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.6.0
- AWS credentials available to the AWS provider
- The `ecolooker-bea` S3 bucket must already exist
- Permissions to create IAM roles/policies and Lambda functions
- (Not strictly required to `apply`, but needed for a non-404 response) the
  `sqgdp-main-metrics-endpoint` Lambda must have run at least once to
  populate `RESULTS_KEY`

## Run it

From this directory (`bea/terraform/actions/sqgdp-main-metrics-reader`):

```bash
terraform init
terraform plan
terraform apply
```

## Test it

```bash
curl -i --compressed "$(terraform output -raw lambda_url)"
```

This is the URL the website's `*_API_URL` env var (see `cfpb-data.ts` for
the pattern this dashboard's data-access module would follow) should point
at -- unlike `sqgdp-main-metrics-endpoint`'s Function URL, which triggers a
recompute and returns write metadata, this one returns the actual payload.

## Tear it down

```bash
terraform destroy
```

## Notes / known limitations

- No auth, rate limiting, or caching layer (e.g. CloudFront) in front of the
  Function URL -- every request is a live Lambda invocation + S3 GetObject.
  Fine for low traffic; put a CDN in front of it if that changes.
- `Cache-Control` on the response is set by this function (`CACHE_CONTROL`
  env var, default 5 minutes), independent of the `Cache-Control: no-cache`
  the writer sets on the S3 object itself -- that header governs the S3
  object's own caching, not what this reader tells clients.
- State is local (`terraform.tfstate` in this directory, gitignored here) --
  not a remote backend.
