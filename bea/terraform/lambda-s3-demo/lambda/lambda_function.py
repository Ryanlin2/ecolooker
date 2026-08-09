import boto3
import json
import os
from datetime import datetime, timezone


s3 = boto3.client("s3")

BUCKET_NAME = os.environ["BUCKET_NAME"]


def lambda_handler(event, context):

    # Get query-string parameters from the GET request
    params = event.get("queryStringParameters") or {}

    name = params.get("name", "world")

    # Our example "processing"
    result = {
        "message": f"Hello {name}",
        "received": params
    }

    # Current time
    now = datetime.now(timezone.utc)

    # Example S3 object path:
    # requests/2026/08/08/request-id.json
    object_key = (
        f"requests/"
        f"{now.year}/"
        f"{now.month:02d}/"
        f"{now.day:02d}/"
        f"{context.aws_request_id}.json"
    )

    # What we'll actually save
    record = {
        "timestamp": now.isoformat(),
        "request_id": context.aws_request_id,
        "http_method": event.get("requestContext", {})
                            .get("http", {})
                            .get("method"),
        "path": event.get("rawPath"),
        "query_parameters": params,
        "result": result
    }

    # Write result to S3
    s3.put_object(
        Bucket=BUCKET_NAME,
        Key=object_key,
        Body=json.dumps(record),
        ContentType="application/json"
    )

    # HTTP response
    return {
        "statusCode": 200,
        "headers": {
            "content-type": "application/json"
        },
        "body": json.dumps({
            "success": True,
            "result": result,
            "bucket": BUCKET_NAME,
            "object_key": object_key
        })
    }