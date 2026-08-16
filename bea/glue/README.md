# bea/glue

AWS Glue jobs that pull BEA SQGDP data into S3 and standardize it into the
`bea.sqgdp_state_gdp` Iceberg table. Deployed by the `sqgdp_full_download`
and `standardize-sqgdp` stacks in [`bea/terraform/actions`](../terraform).

## sqgdp_download_to_s3.py

Python Shell job (not Spark — a zip download and a few dozen `PutObject`s
doesn't need a cluster, and Python Shell jobs start in seconds and bill by
the second). Downloads the BEA `SQGDP.zip` export
(`https://apps.bea.gov/regional/zip/SQGDP.zip`) and lands every `.csv`
member in S3 under its own `ingestion_date=<UTC timestamp>` partition
(to the second), so re-running the job after a BEA refresh never overwrites
a prior pull — the raw landing zone keeps a full history. Mirrors the
"Download" cell in `bea/sqgdp_data/sqgdp.ipynb`, wired to S3 instead of a
local folder.

| Function | What it does |
|---|---|
| `fetch_zip(url)` | Downloads the zip into memory and opens it as a `ZipFile`. |
| `ingestion_prefix(base_prefix)` | Appends a Hive-style `ingestion_date=<UTC timestamp>/` partition to the base S3 prefix. |
| `upload_csvs(zip_file, bucket, prefix)` | Uploads every `.csv` member (skipping `__MACOSX` entries) to `s3://<bucket>/<prefix><name>`. |
| `main()` | Orchestrates: fetch → build partition prefix → upload → log count. |

Job parameters: `JOB_NAME`, `ZIP_URL`, `S3_BUCKET`, `S3_PREFIX` (all
required, resolved via `getResolvedOptions`). Runs with default internet
access (Python Shell, no VPC needed) to reach `apps.bea.gov`.

## sqgdp_iceberg_job.py

Spark ETL job (Glue 4.0+, for native Iceberg support) — the production-sized
equivalent of `bea/sqgdp_data/transform_sqgdp.py`. Reads the most recent
bronze drop, unpivots each `SQGDP{table}__ALL_AREAS_*.csv`'s `YYYY:Qn`
columns into long rows, and `MERGE`s them into Iceberg — an upsert, not an
append, since BEA restates prior quarters on every refresh.

| Function | What it does |
|---|---|
| `latest_ingestion_path(bucket, base_prefix)` | Lists one level deep (`Delimiter="/"`) under `base_prefix` via boto3 to find every `ingestion_date=` partition, then picks the lexically-max one (safe since the timestamp format is fixed-width UTC) and returns a glob over its `__ALL_AREAS` CSVs. Raises if none are found. |
| `read_raw(path)` | Reads the CSV(s) as all-string columns — BEA mixes numeric data and footer note-text in the same columns, so schema inference isn't used. |
| `unpivot(df)` | Turns each `YYYY:Qn` quarter column into `(quarter_col, raw_value)` row pairs via Spark's `stack()`, keyed off the fixed `ID_COLS` set. |
| `standardize(df)` | Filters out footer/note rows (keeps only rows where `LineCode` is non-null and `GeoFIPS` parses as digits after stripping a stray leading-space/quote artifact from BEA's export), parses `quarter_col` into `year`/`quarter`/`period_date`, casts columns to their target types, and stamps `ingested_at`. |
| `ensure_table_exists()` | `CREATE TABLE IF NOT EXISTS` for `sqgdp_state_gdp`, partitioned by `(table_name, years(period_date))`. |
| `merge_into_iceberg(df)` | Registers the standardized DataFrame as a temp view and runs the Iceberg `MERGE`, matching on `(table_name, geo_fips, line_code, period_date)`. |
| `main()` | Orchestrates: find latest partition → read → unpivot → standardize → ensure table → merge → commit. |

Job parameters: `JOB_NAME`, `RAW_S3_BUCKET`, `RAW_S3_PREFIX`,
`ICEBERG_DATABASE`, `ICEBERG_TABLE` (all required), plus the Iceberg Spark
catalog config (`--datalake-formats iceberg` and the `spark.sql.catalog.*`
`--conf` flags) set at the job level, not in this script. Partition
discovery happens inside the script itself, not as a job argument, so
re-running later always picks up whatever the newest bronze drop is with no
redeploy needed.

Target table schema:

```
geo_fips, geo_name, region, table_name, line_code, industry_classification,
description, unit, year, quarter, period_date, value, source_file, ingested_at
```

This is the table [`bea/athena/sqgdp_views.sql`](../athena) reads from.
