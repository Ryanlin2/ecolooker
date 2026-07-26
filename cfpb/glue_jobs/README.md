# cfpb/glue_jobs

AWS Glue (Spark) jobs for the CFPB Consumer Complaint Database pipeline.

## cfpb_complaints_upsert.py

Daily Glue 5.0 job: downloads the full CFPB complaints dump, lands the raw CSV in S3,
cleans/validates it, and upserts it into an Apache Iceberg table via `MERGE`. A full
re-pull is required every run because the CFPB backfills fields on existing complaints
days or weeks after they're first received — a date-window incremental load would miss
those updates. A per-row content hash (`record_hash`) keeps the merge cheap: unchanged
rows produce no write.

This job also owns all row-level cleaning/standardization (see "Cleaning rules" in its
module docstring) — rules originally prototyped in `cfpb_complaints_standardize.py` /
`cfpb/data/cfpb.ipynb` are now applied inline here so there's a single transformation
path instead of a second downstream job.

### Parameters, module-level setup

| Name | What it does |
|---|---|
| `resolve_args()` | Reads Glue job args. Required: `JOB_NAME`, `raw_bucket`, `warehouse`, `catalog_database`. Optional args (`raw_prefix`, `table_name`, `source_url`, `force_download`, `merge_window_days`) are filtered in before `getResolvedOptions` since it throws on absent optional keys, then defaulted. |

Module-level code (not inside a function) builds the `SparkConf` with Iceberg
extensions, starts the `SparkContext`/`GlueContext`/`SparkSession`, and computes the
run's raw S3 key (`raw/cfpb/complaints/load_date=<today>/complaints.csv`).

### Landing the raw file

| Function | What it does |
|---|---|
| `object_exists(bucket, key)` | `HEAD`s an S3 key; returns `False` on 404, re-raises any other error. |
| `land_raw_csv()` | Skips the download if today's object already exists (unless `--force_download`). Otherwise streams the ~1 GB source zip to local disk, opens the CSV member inside it, and streams that decompressed member straight into an S3 multipart upload — the ~10 GB uncompressed payload never touches disk. |

### Cleaning / validation helpers

These operate on the raw string columns (already renamed to snake_case via
`RAW_SCHEMA`/`COLUMN_MAP`) before the final `select`/shape step. Bad-data cases are
hard failures (`ValueError`), not silent nulls — a merge key or partition column
that goes silently wrong would be invisible in the Iceberg target.

| Function | What it does |
|---|---|
| `_distinct_bad_values(df, column, is_bad)` | Shared helper: returns up to 5 distinct non-null values in `column` matching the `is_bad` condition, for error messages. |
| `strict_complaint_id_to_long(df)` | Casts `complaint_id` to `long`; raises if any value isn't a clean integer. |
| `parse_mixed_iso8601(df, column)` | Parses a column that may be either `yyyy-MM-dd'T'HH:mm:ss.SSS'Z'` or `yyyy-MM-dd` into a `date`; raises if any value matches neither format. Used for `date_received` and `date_sent_to_company`. |
| `group_sub_product(df)` | Collapses known messy `sub_product` variants to one canonical label via `SUB_PRODUCT_ALIASES`. Unlisted values are left as-is. |
| `group_issue(df)` | Collapses raw `issue` text into higher-level groups via `ISSUE_GROUPS`; anything unmapped (including true nulls) becomes `"Unknown"`. |
| `group_company_response(df)` | Collapses `company_response_to_consumer` into relief/outcome buckets via `COMPANY_RESPONSE_GROUPS`. Unlisted values are left as-is. |
| `boolify_timely_response(df)` | Maps `timely_response` (`"Yes"`/`"No"`) to a new boolean column `timely_response_flag` via `TIMELY_RESPONSE_MAP`; raises on any other non-null value, since this column has a closed value set per the CFPB field spec. |

### Read + shape

| Function | What it does |
|---|---|
| `read_raw()` | Reads the landed CSV with an explicit string-only schema (`RAW_SCHEMA`) — inferring the schema would cost a second full pass and guess wrong on values like ZIP `"331XX"`. `multiLine=True` is required because narratives contain embedded, RFC4180-quoted newlines, which forces a single-threaded initial read; `repartition(400)` fixes that back up afterward. |
| `transform(df)` | The main per-row pipeline: runs the validation/cleaning helpers above, trims the remaining string columns, adds `consumer_disputed_flag` (permissive Yes/No→boolean, since — unlike `timely_response` — this column has no closed-set spec), adds `has_narrative`, computes `record_hash` (NULL-safe SHA-256 over all business columns except ingestion metadata) plus `ingest_ts`/`source_file`, drops rows with a null `complaint_id` or `date_received`, and collapses duplicate `complaint_id`s (keeping the row with the latest `date_sent_to_company`) since Iceberg `MERGE` aborts if a target row matches more than one source row. |

### Target table

| Function | What it does |
|---|---|
| `table_exists()` | Checks the Glue Catalog for the target Iceberg table. |
| `create_table(source)` | Creates the Iceberg table from the source DataFrame's schema, partitioned by `months(date_received)` (~180 partitions across the dataset's history), with zstd/parquet properties tuned for the write pattern, then sets `WRITE ORDERED BY date_received, complaint_id`. |

### Upsert

| Function | What it does |
|---|---|
| `bootstrap_load(source)` | First-ever load: appends the full source DataFrame directly (no merge needed on an empty table). |
| `merge_load(source)` | Runs the Iceberg `MERGE`: matches target/source on `complaint_id`, updates only when `record_hash` differs, inserts unmatched rows. If `--merge_window_days` is set, also restricts the match predicate to complaints received in that window — faster, but late updates to older complaints outside the window are silently skipped (a deliberate speed/completeness trade-off, off by default). |
| `maintenance()` | Post-load housekeeping: compacts small files (`rewrite_data_files`), expires snapshots older than 7 days (keeping at least 5), and removes orphan files. Wrapped in try/except so a maintenance failure never fails the overall job. |

### Entry point

| Function | What it does |
|---|---|
| `main()` | Orchestrates the whole run: land the raw CSV, transform it, refuse to proceed on zero rows, bootstrap or merge into the target table, run maintenance, and commit the Glue job. |

## cfpb_complaints_standardize.py

Earlier, standalone cleaning job (plain `SparkContext`, `INPUT_PATH`/`OUTPUT_PATH` job
args, writes Parquet) that prototyped the per-column cleaning rules decided in
`cfpb/data/cfpb.ipynb`. **Superseded** — every rule it implements now runs inline
inside `cfpb_complaints_upsert.py`'s `transform()` (see above), so there's one
transformation path instead of two. Kept here for reference; not part of the active
pipeline.

| Function | What it does |
|---|---|
| `read_complaints(spark, path)` | Reads a raw complaints CSV (original CFPB header names, e.g. `"Complaint ID"`, not snake_case). |
| `parse_mixed_iso8601(df, column)` | Same idea as the upsert job's version, but returns a `timestamp` (not cast to `date`) and raises on unparseable values. |
| `flag_missing_complaint_id(df)` | Adds a `"Missing Complaint ID"` boolean column; unlike the upsert job, does **not** drop or fail on missing IDs. |
| `group_sub_product(df)` / `group_issue(df)` / `group_company_response(df)` | Same alias/grouping logic as the upsert job's equivalents, operating on the original CFPB column names. |
| `boolify_timely_response(df)` | Same Yes/No→boolean strict mapping as the upsert job, but overwrites `"Timely response?"` in place rather than adding a separate `_flag` column. |
| `strict_complaint_id_to_long(df)` | Same strict numeric validation as the upsert job's `strict_complaint_id_to_long`, on the original column name. |
| `clean_complaints(df)` | Runs all of the above in sequence. |
| `main()` | Reads `INPUT_PATH`, runs `clean_complaints`, writes the result as Parquet to `OUTPUT_PATH`. |
