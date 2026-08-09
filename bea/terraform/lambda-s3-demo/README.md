# lambda-s3-demo

Minimal demo stack: a public Lambda Function URL that receives a GET request,
builds a small JSON record from it, and writes that record to S3.

## What it creates

- **S3 bucket** (`aws_s3_bucket.results`) — receives one JSON object per request, under
  `requests/YYYY/MM/DD/<request-id>.json`. Public access is blocked at the bucket level.
- **Lambda function** (`request-to-s3`) — Python, handler in `lambda/lambda_function.py`.
  Reads query-string params, writes a record to S3, returns it as JSON.
- **Lambda Function URL** — public HTTPS endpoint, `authorization_type = "NONE"` (no auth).
- **IAM role** — scoped to CloudWatch Logs (`AWSLambdaBasicExecutionRole`) plus
  `s3:PutObject` on the results bucket only.

## Prerequisites

- [Terraform](https://developer.hashicorp.com/terraform/downloads) >= 1.6.0
- An AWS account and credentials available to the AWS provider (e.g. `aws configure`,
  or `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_SESSION_TOKEN` env vars)
- Permissions to create S3 buckets, IAM roles/policies, and Lambda functions

## Run it

From this directory (`bea/terraform/lambda-s3-demo`):

```bash
terraform init
terraform plan
terraform apply
```

`terraform apply` will prompt for confirmation, then print outputs:

- `lambda_url` — the public Function URL
- `bucket_name` — the S3 bucket receiving results
- `lambda_name` — the Lambda function name

To target a different AWS region than the default (`us-east-2`):

```bash
terraform apply -var="aws_region=us-west-2"
```

## Test it

```bash
curl "$(terraform output -raw lambda_url)?name=ecolooker"
```

This returns a JSON response and also writes a matching object to the S3 bucket. Confirm with:

```bash
aws s3 ls "s3://$(terraform output -raw bucket_name)/requests/" --recursive
```

## Tear it down

This endpoint is public and unauthenticated — anyone with the URL can invoke it and
write objects to the bucket, so don't leave it running longer than you need it.

```bash
terraform destroy
```

## Notes / known limitations

- No auth, rate limiting, or reserved concurrency on the Function URL — treat this as a
  local/demo stack only, not something to leave live.
- No S3 lifecycle rule, so request records accumulate indefinitely until destroyed.
- State is local (`terraform.tfstate` in this directory), not a remote backend — don't
  commit `terraform.tfstate` or `.terraform/` to git.
