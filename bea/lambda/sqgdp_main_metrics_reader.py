"""
Lambda endpoint that serves the SQGDP "main metrics" gold JSON payload
(written by sqgdp_main_metrics.py) to any client that asks for it.

Streams the S3 object through as-is -- including its gzip encoding, via
Content-Encoding: gzip -- so this function never pays a decompression cost
and clients get automatic gzip handling from their HTTP layer (fetch(),
browsers, curl --compressed, etc. all do this transparently).

This is the "read" half of the pipeline; sqgdp_main_metrics.py (a separate
Lambda) is the "write" half that queries Athena and refreshes the object
this one serves.

--- Function configuration (set these on the Lambda, not in this script) ---
Runtime:  python3.13+
Timeout:  10s
Memory:   128 MB
Env vars:
  RESULTS_BUCKET   ecolooker-bea
  RESULTS_KEY      gold/endpoints/sqgdp-main-metrics/datasets.json.gz
  ALLOWED_ORIGIN   *                      (optional, CORS)
  CACHE_CONTROL    public, max-age=300    (optional)
IAM: s3:GetObject on RESULTS_KEY only.
---------------------------------------------------------------------------
"""

import base64
import json
import logging
import os
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

s3 = boto3.client("s3")

RESULTS_BUCKET = os.environ["RESULTS_BUCKET"]
RESULTS_KEY = os.environ["RESULTS_KEY"]

ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "*")
CACHE_CONTROL = os.getenv("CACHE_CONTROL", "public, max-age=300")


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    method = (
        event.get("requestContext", {}).get("http", {}).get("method")
        or event.get("httpMethod")
        or "GET"
    )

    if method == "OPTIONS":
        return cors_response(204)

    try:
        response = s3.get_object(Bucket=RESULTS_BUCKET, Key=RESULTS_KEY)
    except ClientError as exc:
        code = exc.response["Error"]["Code"]

        if code in {"404", "NoSuchKey", "NotFound"}:
            logger.warning("No object at s3://%s/%s", RESULTS_BUCKET, RESULTS_KEY)
            return json_error(
                404, "not_found", "No metrics payload has been generated yet."
            )

        logger.exception("Failed to read s3://%s/%s", RESULTS_BUCKET, RESULTS_KEY)
        return json_error(
            502, "upstream_error", "Could not read the metrics payload."
        )

    body = response["Body"].read()

    headers = {
        "Content-Type": response.get("ContentType", "application/json"),
        "Cache-Control": CACHE_CONTROL,
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
        "Access-Control-Allow-Methods": "GET,OPTIONS",
    }

    if response.get("ContentEncoding"):
        headers["Content-Encoding"] = response["ContentEncoding"]

    if response.get("ETag"):
        headers["ETag"] = response["ETag"]

    return {
        "statusCode": 200,
        "headers": headers,
        "body": base64.b64encode(body).decode("ascii"),
        "isBase64Encoded": True,
    }


def cors_response(status_code: int) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        "body": "",
    }


def json_error(status_code: int, error: str, message: str) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        },
        "body": json.dumps({"error": error, "message": message}),
    }
