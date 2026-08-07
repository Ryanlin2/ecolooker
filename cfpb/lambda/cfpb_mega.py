import gzip
import json
import logging
import os
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

import boto3
from botocore.exceptions import ClientError

logger = logging.getLogger()
logger.setLevel(logging.INFO)

athena = boto3.client("athena")
s3 = boto3.client("s3")

ATHENA_DATABASE = os.environ["ATHENA_DATABASE"]
ATHENA_OUTPUT_LOCATION = os.environ["ATHENA_OUTPUT_LOCATION"]

RESULTS_BUCKET = os.environ["RESULTS_BUCKET"]
RESULTS_KEY = os.getenv("RESULTS_KEY", "analytics/datasets.json.gz")

ATHENA_WORKGROUP = os.getenv("ATHENA_WORKGROUP", "primary")
ATHENA_CATALOG = os.getenv("ATHENA_CATALOG", "AwsDataCatalog")
ALLOWED_ORIGIN = os.getenv("ALLOWED_ORIGIN", "*")

DEFAULT_LIMIT = int(os.getenv("DEFAULT_LIMIT", "500"))
MAX_LIMIT = int(os.getenv("MAX_LIMIT", "5000"))
QUERY_TIMEOUT_SECONDS = int(os.getenv("QUERY_TIMEOUT_SECONDS", "20"))

FLOAT_PRECISION = int(os.getenv("FLOAT_PRECISION", "2"))
TIMEZONE_NAME = os.getenv("DATA_TIMEZONE", "UTC")

# Columns that are derivable from base measures. Dropped from the payload;
# recompute in the consumer. Set DROP_DERIVED=false to keep them.
DROP_DERIVED = os.getenv("DROP_DERIVED", "true").lower() == "true"

DERIVED_COLUMNS = {
    "avg_7d",
    "avg_30d",
    "dod_change",
    "wow_change",
    "wow_pct_change",
    "mom_change",
    "mom_pct_change",
}

DATASETS = {
    "volume_daily": {
        "view": "vw_volume_daily",
        "order_by": "day_received DESC",
        "order": "desc",
    },
    "volume_anomaly_product_issue": {
        "view": "vw_volume_anomaly_product_issue",
        "order_by": "day_received DESC, ABS(z_score) DESC",
        "order": "desc",
    },
    "volume_seasonality": {
        "view": "vw_volume_seasonality",
        "order_by": "month_of_year, dow",
        "order": "asc",
    },
    "mix_product_monthly": {
        "view": "vw_mix_product_monthly",
        "order_by": "month_received DESC, complaints DESC",
        "order": "desc",
    },
    "fastest_growing_issues": {
        "view": "vw_fastest_growing_issues",
        "order_by": "month_received DESC, growth_rank",
        "order": "desc",
    },
    "product_issue_heatmap": {
        "view": "vw_product_issue_heatmap",
        "order_by": "month_received DESC, product, complaints DESC",
        "order": "desc",
    },
    "issue_concentration_hhi": {
        "view": "vw_issue_concentration_hhi",
        "order_by": "month_received DESC, hhi DESC",
        "order": "desc",
    },
    "geo_state_anomaly": {
        "view": "vw_geo_state_anomaly",
        "where": "is_spike AND month_received >= DATE_ADD('day', -30, CURRENT_DATE)",
        "order_by": "month_received DESC, z_score DESC",
        "order": "desc",
    },
}

# Columns treated as the dataset's date/period axis, used to publish range bounds.
DATE_COLUMNS = ("day_received", "month_received")


class RequestError(Exception):
    """Represents a client-side request error."""


def lambda_handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    try:
        query_params = event.get("queryStringParameters") or {}

        requested_datasets = parse_dataset_parameter(
            query_params.get("dataset", "all")
        )
        limit = parse_limit(query_params.get("limit"))
        key = query_params.get("key") or RESULTS_KEY

        results: dict[str, dict[str, Any]] = {}
        max_workers = min(4, len(requested_datasets))

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(query_dataset, dataset, limit): dataset
                for dataset in requested_datasets
            }

            for future in as_completed(futures):
                dataset = futures[future]
                results[dataset] = future.result()

        ordered_results = {
            dataset: results[dataset]
            for dataset in requested_datasets
        }

        response_body = {
            "schema_version": "2.0",
            "generated_at": datetime.now(timezone.utc).isoformat(
                timespec="seconds"
            ),
            "timezone": TIMEZONE_NAME,
            "encoding": "columnar",
            "datasets": ordered_results,
        }

        write_result = put_results(key, response_body)

        return api_response(
            200,
            {
                "location": f"s3://{RESULTS_BUCKET}/{key}",
                "replaced": write_result["replaced"],
                "previous_version_id": write_result["previous_version_id"],
                "version_id": write_result["version_id"],
                "bytes": write_result["bytes"],
                "uncompressed_bytes": write_result["uncompressed_bytes"],
            },
        )

    except RequestError as exc:
        return api_response(
            400,
            {
                "error": "invalid_request",
                "message": str(exc),
            },
        )

    except TimeoutError as exc:
        logger.exception("Athena query timed out")

        return api_response(
            504,
            {
                "error": "query_timeout",
                "message": str(exc),
            },
        )

    except Exception:
        logger.exception("Failed to query analytics views")

        return api_response(
            500,
            {
                "error": "internal_error",
                "message": "The analytics query could not be completed.",
            },
        )


def put_results(key: str, body: dict[str, Any]) -> dict[str, Any]:
    """
    Write the gzipped payload to S3, overwriting any existing object at the key.
    """
    existing = head_object(key)

    if existing is not None:
        logger.info(
            "Existing object found at s3://%s/%s (size=%s, modified=%s); replacing it.",
            RESULTS_BUCKET,
            key,
            existing.get("ContentLength"),
            existing.get("LastModified"),
        )
    else:
        logger.info(
            "No existing object at s3://%s/%s; creating it.",
            RESULTS_BUCKET,
            key,
        )

    raw = json.dumps(
        body,
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode("utf-8")

    payload = gzip.compress(raw, compresslevel=6)

    response = s3.put_object(
        Bucket=RESULTS_BUCKET,
        Key=key,
        Body=payload,
        ContentType="application/json",
        ContentEncoding="gzip",
        CacheControl="no-cache",
    )

    logger.info(
        "Wrote %s bytes (%s uncompressed, %.1fx) to s3://%s/%s",
        len(payload),
        len(raw),
        len(raw) / max(len(payload), 1),
        RESULTS_BUCKET,
        key,
    )

    return {
        "replaced": existing is not None,
        "previous_version_id": (existing or {}).get("VersionId"),
        "version_id": response.get("VersionId"),
        "bytes": len(payload),
        "uncompressed_bytes": len(raw),
    }


def head_object(key: str) -> dict[str, Any] | None:
    try:
        return s3.head_object(Bucket=RESULTS_BUCKET, Key=key)
    except ClientError as exc:
        code = exc.response["Error"]["Code"]

        if code in {"404", "NoSuchKey", "NotFound"}:
            return None

        raise


def parse_dataset_parameter(value: str) -> list[str]:
    value = value.strip()

    if value == "all":
        return list(DATASETS.keys())

    requested = [
        item.strip()
        for item in value.split(",")
        if item.strip()
    ]

    if not requested:
        raise RequestError("At least one dataset must be specified.")

    invalid = [
        dataset
        for dataset in requested
        if dataset not in DATASETS
    ]

    if invalid:
        allowed = ", ".join(DATASETS.keys())
        raise RequestError(
            f"Unknown dataset(s): {', '.join(invalid)}. "
            f"Allowed datasets: {allowed}."
        )

    return list(dict.fromkeys(requested))


def parse_limit(raw_limit: str | None) -> int:
    if raw_limit is None:
        return DEFAULT_LIMIT

    try:
        limit = int(raw_limit)
    except ValueError as exc:
        raise RequestError("The limit parameter must be an integer.") from exc

    if limit < 1:
        raise RequestError("The limit parameter must be at least 1.")

    return min(limit, MAX_LIMIT)


def query_dataset(
    dataset: str,
    limit: int,
) -> dict[str, Any]:
    config = DATASETS[dataset]

    where_clause = f"WHERE {config['where']}" if "where" in config else ""

    sql = f"""
        SELECT *
        FROM "{config['view']}"
        {where_clause}
        ORDER BY {config['order_by']}
        LIMIT {limit}
    """

    logger.info(
        "Querying dataset=%s view=%s limit=%s",
        dataset,
        config["view"],
        limit,
    )

    execution_id = start_query(sql)

    try:
        wait_for_query(execution_id)
        fields, rows = get_query_rows(execution_id, limit)
    except TimeoutError:
        athena.stop_query_execution(QueryExecutionId=execution_id)
        raise

    return build_dataset(dataset, fields, rows)


def build_dataset(
    dataset: str,
    fields: list[str],
    rows: list[list[Any]],
) -> dict[str, Any]:
    """
    Assemble the columnar dataset block: field list, row-array data,
    declared ordering, and date-range bounds.
    """
    config = DATASETS[dataset]

    block: dict[str, Any] = {
        "order": config["order"],
        "row_count": len(rows),
        "fields": fields,
        "data": rows,
    }

    date_index = next(
        (
            fields.index(column)
            for column in DATE_COLUMNS
            if column in fields
        ),
        None,
    )

    if date_index is not None and rows:
        values = [
            row[date_index]
            for row in rows
            if row[date_index] is not None
        ]

        if values:
            block["date_field"] = fields[date_index]
            block["start"] = min(values)
            block["end"] = max(values)

    return block


def start_query(sql: str) -> str:
    request: dict[str, Any] = {
        "QueryString": sql,
        "QueryExecutionContext": {
            "Catalog": ATHENA_CATALOG,
            "Database": ATHENA_DATABASE,
        },
        "WorkGroup": ATHENA_WORKGROUP,
        "ResultConfiguration": {
            "OutputLocation": ATHENA_OUTPUT_LOCATION,
        },
        "ResultReuseConfiguration": {
            "ResultReuseByAgeConfiguration": {
                "Enabled": True,
                "MaxAgeInMinutes": 5,
            }
        },
    }

    response = athena.start_query_execution(**request)
    return response["QueryExecutionId"]


def wait_for_query(execution_id: str) -> None:
    deadline = time.monotonic() + QUERY_TIMEOUT_SECONDS
    sleep_seconds = 0.25

    while time.monotonic() < deadline:
        response = athena.get_query_execution(
            QueryExecutionId=execution_id
        )

        status = response["QueryExecution"]["Status"]
        state = status["State"]

        if state == "SUCCEEDED":
            return

        if state in {"FAILED", "CANCELLED"}:
            reason = status.get(
                "StateChangeReason",
                "No failure reason was returned.",
            )
            raise RuntimeError(
                f"Athena query {state.lower()}: {reason}"
            )

        time.sleep(sleep_seconds)
        sleep_seconds = min(sleep_seconds * 1.5, 1.5)

    raise TimeoutError(
        f"Athena query exceeded {QUERY_TIMEOUT_SECONDS} seconds."
    )


def get_query_rows(
    execution_id: str,
    limit: int,
) -> tuple[list[str], list[list[Any]]]:
    """
    Return (fields, rows) where rows are positional arrays aligned to fields.
    Derived columns are excluded when DROP_DERIVED is enabled.
    """
    rows_out: list[list[Any]] = []
    next_token: str | None = None
    first_page = True
    column_info: list[dict[str, Any]] = []
    keep_indexes: list[int] = []
    fields: list[str] = []

    while len(rows_out) < limit:
        request: dict[str, Any] = {
            "QueryExecutionId": execution_id,
            "MaxResults": min(1000, limit + 1),
        }

        if next_token:
            request["NextToken"] = next_token

        response = athena.get_query_results(**request)
        result_set = response["ResultSet"]

        if not column_info:
            column_info = result_set["ResultSetMetadata"]["ColumnInfo"]
            keep_indexes = [
                index
                for index, column in enumerate(column_info)
                if not (DROP_DERIVED and column["Name"] in DERIVED_COLUMNS)
            ]
            fields = [column_info[index]["Name"] for index in keep_indexes]

        rows = result_set.get("Rows", [])

        if first_page and rows:
            rows = rows[1:]
            first_page = False

        for row in rows:
            rows_out.append(
                convert_row(
                    row.get("Data", []),
                    column_info,
                    keep_indexes,
                )
            )

            if len(rows_out) >= limit:
                break

        next_token = response.get("NextToken")

        if not next_token:
            break

    return fields, rows_out


def convert_row(
    values: list[dict[str, str]],
    column_info: list[dict[str, Any]],
    keep_indexes: list[int],
) -> list[Any]:
    row: list[Any] = []

    for index in keep_indexes:
        athena_type = column_info[index]["Type"]

        raw_value = None

        if index < len(values):
            raw_value = values[index].get("VarCharValue")

        row.append(convert_value(raw_value, athena_type))

    return row


def convert_value(
    value: str | None,
    athena_type: str,
) -> Any:
    if value is None:
        return None

    normalized_type = athena_type.lower()

    integer_types = {"tinyint", "smallint", "integer", "int", "bigint"}
    decimal_types = {"float", "real", "double"}

    if normalized_type in integer_types:
        return int(value)

    if normalized_type in decimal_types:
        return round(float(value), FLOAT_PRECISION)

    if normalized_type.startswith("decimal"):
        decimal_value = Decimal(value)

        if decimal_value == decimal_value.to_integral_value():
            return int(decimal_value)

        return round(float(decimal_value), FLOAT_PRECISION)

    if normalized_type == "boolean":
        return value.lower() == "true"

    return value


def api_response(
    status_code: int,
    body: dict[str, Any],
) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,OPTIONS",
        },
        "body": json.dumps(
            body,
            separators=(",", ":"),
            ensure_ascii=False,
        ),
    }