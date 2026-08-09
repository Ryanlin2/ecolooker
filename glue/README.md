# glue

Standalone AWS Glue (Spark) utility jobs that aren't specific to any one
dataset's pipeline.

## rollback.py

Rolls an Apache Iceberg table registered in the Glue Data Catalog back to a
prior snapshot. This is the emergency lever for the ingestion jobs in
[`cfpb/glue_jobs`](../cfpb/glue_jobs) (or any other job writing into the same
warehouse) when a bad `MERGE` lands corrupt or duplicated data and the fix is
"go back to the last known-good state" rather than a forward-fixing re-run.

Target a snapshot two ways:

- `--snapshot_id` — exact Iceberg snapshot ID (the job prints a log of recent
  snapshots before rolling back)
- `--rollback_timestamp` — ISO 8601 timestamp; rolls back to whatever
  snapshot was current as of that instant

Exactly one of the two must be supplied.

### Required job parameters

| Parameter | Description |
|---|---|
| `--warehouse` | `s3://.../warehouse` — Iceberg warehouse root |
| `--catalog_database` | Glue database name (must already exist) |
| `--snapshot_id` or `--rollback_timestamp` | Exactly one required |

### Notable implementation detail

Glue database/table names can contain characters (most commonly a hyphen,
e.g. `cfpb-complaints`) that aren't valid in an unquoted Spark SQL identifier
— `cfpb-complaints` parses as `cfpb MINUS complaints`, not a table name,
unless every identifier segment is backtick-quoted. `quote_ident()` handles
this, and every SQL string the job builds (including the `.snapshots`
metadata-table reference and the `system.rollback_to_snapshot` call) goes
through it rather than raw string interpolation.
