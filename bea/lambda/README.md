# bea/lambda

Two Lambda functions forming the write/read split for the "US Industry GDP"
dashboard's data endpoint. Same split pattern as `cfpb/lambda/cfpb_mega.py`,
just broken into two functions here instead of one. Deployed by the
`sqgdp-main-metrics-endpoint` and `sqgdp-main-metrics-reader` stacks in
[`bea/terraform/actions`](../terraform).

## sqgdp_main_metrics.py — the write side

Lambda Function URL handler (`GET /?dataset=...&limit=...`). On invocation:

1. Parses `dataset` (comma-separated list from `national_gdp`, `state_gdp`,
   `industry_gdp`, or `all` — default) and `limit` (default 500, capped at
   `MAX_LIMIT` = 5000).
2. Runs one Athena query per requested dataset **in parallel**
   (`ThreadPoolExecutor`, up to 4 workers) against the corresponding view in
   [`bea/athena/sqgdp_views.sql`](../athena) (`v_us_national_gdp`,
   `v_us_state_gdp`, `v_us_industry_gdp`), each ordered per the `DATASETS`
   config and capped at `limit` rows.
3. Converts each result set into a columnar `{fields, data}` block
   (positional row arrays, typed/rounded values via `convert_value`) with
   `date_field`/`start`/`end` bounds derived from the `period_date` column.
4. Gzips the combined `{schema_version, generated_at, timezone, datasets}`
   payload and `PutObject`s it to `RESULTS_KEY` in `RESULTS_BUCKET`,
   overwriting any prior version.
5. Returns write metadata (S3 location, byte counts, version id) as the HTTP
   response — **not the payload itself**. This function's job is to refresh
   the gold S3 object; clients should read that object (or go through
   `sqgdp_main_metrics_reader.py`), not this Function URL.

| Function | What it does |
|---|---|
| `lambda_handler(event, context)` | Entry point: parse params, fan out queries, assemble payload, write to S3, return write metadata. Maps `RequestError`/`TimeoutError`/other exceptions to 400/504/500 responses. |
| `parse_dataset_parameter(value)` | Validates/dedupes the `dataset` query param against `DATASETS`. |
| `parse_limit(raw_limit)` | Validates the `limit` query param, clamps to `MAX_LIMIT`. |
| `query_dataset(dataset, limit)` | Starts an Athena query for one dataset, waits for it, fetches rows. |
| `build_dataset(dataset, fields, rows)` | Assembles one dataset's columnar block including date-range bounds. |
| `start_query(sql)` / `wait_for_query(execution_id)` / `get_query_rows(execution_id, limit)` | Athena `StartQueryExecution` → poll `GetQueryExecution` (exponential backoff up to 1.5s, `QUERY_TIMEOUT_SECONDS` = 20 total) → paginate `GetQueryResults`. Result reuse is enabled (`MaxAgeInMinutes: 5`) so back-to-back invocations don't always re-scan. |
| `convert_row(values, column_info)` / `convert_value(value, athena_type)` | Converts Athena's string-typed result cells to native JSON types (int/float/bool) per column type, rounding floats/decimals to `FLOAT_PRECISION`. |
| `put_results(key, body)` / `head_object(key)` | Writes the gzipped JSON to S3, logging whether it replaced an existing object. |
| `api_response(status_code, body)` | Wraps a response body with CORS headers (`ALLOWED_ORIGIN`) and standard JSON headers. |

Env vars: `ATHENA_DATABASE`, `ATHENA_OUTPUT_LOCATION`, `RESULTS_BUCKET`
(required); `RESULTS_KEY`, `ATHENA_WORKGROUP`, `ATHENA_CATALOG`,
`ALLOWED_ORIGIN`, `DEFAULT_LIMIT`, `MAX_LIMIT`, `QUERY_TIMEOUT_SECONDS`,
`FLOAT_PRECISION`, `DATA_TIMEZONE` (optional, defaulted). Runtime
python3.13+, 256 MB, 60s timeout.

## sqgdp_main_metrics_reader.py — the read side

Lambda Function URL handler that serves the gold JSON payload written by
`sqgdp_main_metrics.py` to any client. `GetObject`s `RESULTS_KEY` and
streams the bytes straight through — including `Content-Encoding: gzip` —
so it never pays a decompression cost server-side; browsers/`fetch()`/`curl
--compressed` all decode gzip transparently. Returns `404` if the object
doesn't exist yet (writer hasn't run) or `502` on any other S3 read
failure. `OPTIONS` requests get a bare CORS preflight response.

| Function | What it does |
|---|---|
| `lambda_handler(event, context)` | Entry point: handle `OPTIONS`, else `GetObject` and stream through with matching headers (`Content-Type`, `Content-Encoding`, `ETag`, `Cache-Control`, CORS). |
| `cors_response(status_code)` | Bare CORS preflight response. |
| `json_error(status_code, error, message)` | JSON error body with CORS headers. |

Env vars: `RESULTS_BUCKET`, `RESULTS_KEY` (required); `ALLOWED_ORIGIN`,
`CACHE_CONTROL` (optional, defaults to `public, max-age=300`). Runtime
python3.13+, 128 MB, 10s timeout. This is the URL the website's data-access
module (see the pattern in `cfpb-data.ts`) should actually point at — unlike
`sqgdp_main_metrics.py`'s Function URL, which triggers a recompute and
returns write metadata rather than the data itself.
