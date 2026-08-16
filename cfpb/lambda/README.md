# cfpb/lambda

## `cfpb_mega.py`

Single Lambda handler that queries the CFPB Athena views (see
[`../glue_views/README.md`](../glue_views/README.md)) and materializes their results as
one gzip-compressed JSON payload cached in S3, for the `ecolooker-webapp` CFPB complaints
dashboard to read.

It's invoked via API Gateway as a GET request, not called directly by the browser — the
Lambda's own HTTP response reports where it wrote the payload, not the payload itself. The
dashboard reads the cached `datasets.json.gz` object from S3 (or a CDN in front of it).
That makes this Lambda function as much a **cache-warming job** as a query API: hitting it
re-runs the Athena queries and refreshes the S3 cache; page loads don't round-trip through
Athena.

### Request flow

1. Parse query-string params: `dataset` (comma-separated list of dataset keys, or `all` —
   default), `limit` (per-dataset row cap, clamped to `MAX_LIMIT`), `key` (S3 destination
   key override, default `RESULTS_KEY`).
2. For each requested dataset key, look up its config in the static `DATASETS` registry
   (dataset name → Athena view name + optional `WHERE` filter + `ORDER BY` + declared sort
   direction) — see table below.
3. Run each dataset's query concurrently (`ThreadPoolExecutor`, up to 4 workers) against
   Athena, each with a `QUERY_TIMEOUT_SECONDS` (default 20s) wait budget; a query that
   blows the budget is explicitly `stop_query_execution`'d and the whole request fails
   with a 504. Athena's built-in result-reuse cache (`MaxAgeInMinutes: 5`) is enabled, so
   back-to-back invocations within 5 minutes skip re-executing identical SQL.
4. Convert each result row from Athena's string-typed cells to native JSON types
   (`convert_value`, keyed off the column's Athena type: ints, floats/decimals rounded to
   `FLOAT_PRECISION`, booleans, else passthrough string).
5. Drop the derived/recomputable columns (`DERIVED_COLUMNS` below) from the payload when
   `DROP_DERIVED` is enabled (default) — smaller payload, since a consumer with the base
   measures can recompute rolling averages/deltas itself.
6. Assemble each dataset into a columnar block: `{order, row_count, fields, data}`, plus
   `{date_field, start, end}` bounds when the result has a `day_received` or
   `month_received` column (`DATE_COLUMNS`).
7. Wrap all requested datasets into one response body: `{schema_version, generated_at,
   timezone, encoding: "columnar", datasets: {...}}`, `json.dumps` it compactly, gzip it
   (`compresslevel=6`), and `PUT` it to `s3://RESULTS_BUCKET/key` with
   `ContentEncoding: gzip` — overwriting whatever was there before.
8. Return a 200 with write metadata: S3 location, whether an object was replaced, old/new
   `VersionId`, and compressed/uncompressed byte sizes (useful for monitoring payload
   growth over time, since S3 versioning captures every write).

### `DATASETS` registry

| Dataset key | Athena view | Extra `WHERE` | `ORDER BY` |
|---|---|---|---|
| `volume_daily` | `vw_volume_daily` | — | `day_received DESC` |
| `volume_anomaly_product_issue` | `vw_volume_anomaly_product_issue` | `ABS(z_score) >= 3 AND day_received >= this year` | `day_received DESC, ABS(z_score) DESC` |
| `volume_seasonality` | `vw_volume_seasonality` | — | `month_of_year, dow` |
| `mix_product_monthly` | `vw_mix_product_monthly` | — | `month_received DESC, complaints DESC` |
| `fastest_growing_issues` | `vw_fastest_growing_issues` | — | `month_received DESC, growth_rank` |
| `product_issue_heatmap` | `vw_product_issue_heatmap` | — | `month_received DESC, product, complaints DESC` |
| `issue_concentration_hhi` | `vw_issue_concentration_hhi` | — | `month_received DESC, hhi DESC` |
| `geo_state_anomaly` | `vw_geo_state_anomaly` | `z_score >= 3 AND complaints >= 10 AND day_received >= this year` | `day_received DESC, z_score DESC` |

**`product_issue_heatmap` points at a view (`vw_product_issue_heatmap`) that has no
corresponding `CREATE VIEW` in [`../glue_views/`](../glue_views/README.md)** — the file
named `vw_product_issue_heatmap.sql` there actually defines `vw_mix_product_monthly`
instead. Requesting `dataset=product_issue_heatmap` will fail unless that Athena view
exists independently of what's checked into this repo. See the "filename mismatch" note
in `glue_views/README.md` before relying on this dataset.

### `DERIVED_COLUMNS` (dropped from payload when `DROP_DERIVED=true`)

`avg_7d`, `avg_30d`, `dod_change`, `wow_change`, `wow_pct_change`, `mom_change`,
`mom_pct_change` — all recomputable client-side from base measures already in the
payload (e.g. `vw_volume_daily`'s raw `complaints` column).

### Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `ATHENA_DATABASE` | Yes | — | Athena database queried for all views |
| `ATHENA_OUTPUT_LOCATION` | Yes | — | S3 prefix Athena writes query staging results to |
| `RESULTS_BUCKET` | Yes | — | S3 bucket the final gzip JSON payload is written to |
| `RESULTS_KEY` | No | `analytics/datasets.json.gz` | Default S3 key for the payload; overridable per-request via `?key=` |
| `ATHENA_WORKGROUP` | No | `primary` | Athena workgroup used for query execution |
| `ATHENA_CATALOG` | No | `AwsDataCatalog` | Data catalog passed to Athena's `QueryExecutionContext` |
| `ALLOWED_ORIGIN` | No | `*` | Value for `Access-Control-Allow-Origin` |
| `DEFAULT_LIMIT` | No | `500` | Row cap applied when `?limit=` is omitted |
| `MAX_LIMIT` | No | `5000` | Hard ceiling `?limit=` is clamped to |
| `QUERY_TIMEOUT_SECONDS` | No | `20` | Max wait per Athena query before it's stopped and a 504 returned |
| `FLOAT_PRECISION` | No | `2` | Decimal places float/double/decimal columns are rounded to |
| `DATA_TIMEZONE` | No | `UTC` | Stamped into the response's `timezone` field (labeling only — doesn't affect query execution, since all the underlying date/timestamp columns are UTC) |
| `DROP_DERIVED` | No | `true` | Whether to drop `DERIVED_COLUMNS` from the payload |

### Error handling

| Failure | HTTP status | Body |
|---|---|---|
| Bad `dataset`/`limit` param (`RequestError`) | 400 | `{"error": "invalid_request", "message": ...}` |
| Athena query exceeds `QUERY_TIMEOUT_SECONDS` | 504 | `{"error": "query_timeout", "message": ...}` |
| Anything else | 500 | `{"error": "internal_error", ...}` (full exception logged server-side only, not returned to the caller) |

Every response — success or error — carries CORS headers (`Access-Control-Allow-Origin`,
`-Headers`, `-Methods: GET,OPTIONS`).
