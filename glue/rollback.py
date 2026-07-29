"""
rollback.py
===========
AWS Glue 5.0 (Spark 3.5) utility job.

Rolls an Apache Iceberg table registered in the Glue Data Catalog back to a
prior snapshot — the emergency lever for cfpb_complaints_upsert.py (or any
other job writing into this warehouse) when a bad MERGE lands corrupt or
duplicated data and the fix is "go back to the last known-good state" rather
than a forward-fixing re-run.

Target a snapshot two ways:
  --snapshot_id         exact Iceberg snapshot ID (see the recent-snapshots
                         log line this job prints before rolling back)
  --rollback_timestamp  ISO 8601 timestamp; rolls back to the snapshot that
                         was current as of that instant

Exactly one of the two must be supplied.

Identifier quoting
-------------------
Glue database/table names can contain characters — most commonly a hyphen,
e.g. "cfpb-complaints" — that are not valid in an unquoted Spark SQL
identifier. `cfpb-complaints` parses as the expression `cfpb MINUS
complaints`, not a table name, unless every identifier segment is
backtick-quoted. `quote_ident()` below backtick-quotes each segment and
escapes embedded backticks, and every SQL string built here — including the
`.snapshots` metadata-table reference and the `system.rollback_to_snapshot`
table argument — goes through it rather than raw f-string interpolation.

Required job parameters
------------------------
  --warehouse             s3://.../warehouse   (Iceberg warehouse root)
  --catalog_database      Glue database name (must already exist)

One of these two is required
------------------------------
  --snapshot_id           exact snapshot ID to roll back to
  --rollback_timestamp    ISO 8601 timestamp to roll back to

Optional job parameters
------------------------
  --table_name            default: complaints
  --dry_run               "true" to log the resolved target snapshot and the
                           table's recent snapshot history without executing
                           the rollback. default: false
"""

import logging
import sys
from datetime import datetime
from typing import Optional

from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark import SparkConf, SparkContext
from pyspark.sql import SparkSession

logging.basicConfig(format="%(asctime)s %(levelname)s %(message)s", level=logging.INFO)
log = logging.getLogger("cfpb-rollback")

CATALOG = "glue_catalog"

# ---------------------------------------------------------------------------
# 1. Parameters
# ---------------------------------------------------------------------------

REQUIRED = ["JOB_NAME", "warehouse", "catalog_database"]
OPTIONAL = {
    "table_name": "complaints",
    "snapshot_id": "",
    "rollback_timestamp": "",
    "dry_run": "false",
}


def resolve_args() -> dict:
    """getResolvedOptions throws on absent optional params, so pre-filter argv."""
    present = [k for k in OPTIONAL if f"--{k}" in sys.argv]
    args = getResolvedOptions(sys.argv, REQUIRED + present)
    for key, default in OPTIONAL.items():
        args.setdefault(key, default)
    return args


args = resolve_args()
WAREHOUSE = args["warehouse"].rstrip("/")
DATABASE = args["catalog_database"]
TABLE = args["table_name"]
SNAPSHOT_ID = args["snapshot_id"] or None
ROLLBACK_TIMESTAMP = args["rollback_timestamp"] or None
DRY_RUN = args["dry_run"].lower() == "true"

if bool(SNAPSHOT_ID) == bool(ROLLBACK_TIMESTAMP):
    raise ValueError(
        "Exactly one of --snapshot_id or --rollback_timestamp must be supplied "
        f"(got snapshot_id={SNAPSHOT_ID!r}, rollback_timestamp={ROLLBACK_TIMESTAMP!r})."
    )

# ---------------------------------------------------------------------------
# 2. Identifier quoting
# ---------------------------------------------------------------------------


def quote_ident(identifier: str) -> str:
    """Backtick-quote a single SQL identifier segment, escaping embedded backticks.

    Required for database/table names with characters invalid in an unquoted
    identifier — e.g. the hyphen in "cfpb-complaints".
    """
    return "`" + identifier.replace("`", "``") + "`"


FQTN = f"{CATALOG}.{quote_ident(DATABASE)}.{quote_ident(TABLE)}"
SNAPSHOTS_TABLE = f"{FQTN}.snapshots"

# system.rollback_to_snapshot takes the target table as a single string
# literal (not a multi-part identifier), so it needs its own backtick-quoted
# db.table form — built the same way as FQTN, just without the catalog segment.
CALL_TABLE_ARG = f"{quote_ident(DATABASE)}.{quote_ident(TABLE)}".replace("'", "''")

# ---------------------------------------------------------------------------
# 3. Spark / Iceberg bootstrap
# ---------------------------------------------------------------------------

conf = (
    SparkConf()
    .set("spark.sql.extensions", "org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions")
    .set(f"spark.sql.catalog.{CATALOG}", "org.apache.iceberg.spark.SparkCatalog")
    .set(f"spark.sql.catalog.{CATALOG}.warehouse", WAREHOUSE)
    .set(f"spark.sql.catalog.{CATALOG}.catalog-impl", "org.apache.iceberg.aws.glue.GlueCatalog")
    .set(f"spark.sql.catalog.{CATALOG}.io-impl", "org.apache.iceberg.aws.s3.S3FileIO")
)

sc = SparkContext(conf=conf)
glue_context = GlueContext(sc)
spark: SparkSession = glue_context.spark_session
job = Job(glue_context)
job.init(args["JOB_NAME"], args)

# ---------------------------------------------------------------------------
# 4. Snapshot inspection
# ---------------------------------------------------------------------------


def table_exists() -> bool:
    return spark.catalog.tableExists(FQTN)


def current_snapshot_id() -> Optional[int]:
    rows = spark.sql(f"SELECT snapshot_id FROM {SNAPSHOTS_TABLE} ORDER BY committed_at DESC LIMIT 1").collect()
    return rows[0]["snapshot_id"] if rows else None


def log_recent_snapshots(limit: int = 10) -> None:
    rows = spark.sql(
        f"SELECT snapshot_id, committed_at, operation "
        f"FROM {SNAPSHOTS_TABLE} ORDER BY committed_at DESC LIMIT {limit}"
    ).collect()
    log.info("Recent snapshots for %s (most recent first):", FQTN)
    for row in rows:
        log.info(
            "  snapshot_id=%s  committed_at=%s  operation=%s",
            row["snapshot_id"], row["committed_at"], row["operation"],
        )


def resolve_target_snapshot_id() -> int:
    """Return the snapshot_id the rollback will target, without performing it.

    Resolving a --rollback_timestamp to a concrete snapshot_id here (rather
    than calling system.rollback_to_timestamp directly) lets --dry_run and
    the pre-rollback log line report the actual snapshot being targeted.
    """
    if SNAPSHOT_ID:
        return int(SNAPSHOT_ID)

    ts = datetime.fromisoformat(ROLLBACK_TIMESTAMP)
    rows = spark.sql(
        f"SELECT snapshot_id FROM {SNAPSHOTS_TABLE} "
        f"WHERE committed_at <= TIMESTAMP '{ts.isoformat(sep=' ')}' "
        f"ORDER BY committed_at DESC LIMIT 1"
    ).collect()
    if not rows:
        raise ValueError(f"No snapshot of {FQTN} exists at or before {ROLLBACK_TIMESTAMP}.")
    return rows[0]["snapshot_id"]


# ---------------------------------------------------------------------------
# 5. Rollback
# ---------------------------------------------------------------------------


def rollback_to_snapshot(snapshot_id: int) -> None:
    spark.sql(
        f"CALL {CATALOG}.system.rollback_to_snapshot("
        f"table => '{CALL_TABLE_ARG}', snapshot_id => {snapshot_id})"
    )


# ---------------------------------------------------------------------------
# 6. Main
# ---------------------------------------------------------------------------


def main() -> None:
    if not table_exists():
        raise RuntimeError(f"Table {FQTN} does not exist — nothing to roll back.")

    before = current_snapshot_id()
    log.info("Current snapshot of %s: %s", FQTN, before)
    log_recent_snapshots()

    target_id = resolve_target_snapshot_id()
    log.info("Resolved rollback target: snapshot_id=%s", target_id)

    if target_id == before:
        log.info("Target snapshot is already current — nothing to do.")
        job.commit()
        return

    if DRY_RUN:
        log.info("Dry run — not executing rollback_to_snapshot.")
        job.commit()
        return

    rollback_to_snapshot(target_id)

    after = current_snapshot_id()
    log.info("Rollback complete. %s snapshot: %s -> %s", FQTN, before, after)

    job.commit()


if __name__ == "__main__":
    main()
