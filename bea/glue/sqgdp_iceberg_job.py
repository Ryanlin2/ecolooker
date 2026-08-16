"""
AWS Glue ETL job: standardize raw SQGDP __ALL_AREAS CSVs in S3 into the
`sqgdp_state_gdp` Apache Iceberg table via the Glue Data Catalog.

Spark equivalent of bea/sqgdp_data/transform_sqgdp.py, sized for production
volume. Unpivots each SQGDP{table}__ALL_AREAS_*.csv's YYYY:Qn columns into
long rows and MERGEs them into Iceberg on (table_name, geo_fips, line_code,
period_date) -- an upsert, not an append, since BEA restates prior quarters
on every refresh.

--- Job configuration (set these on the Glue job, not in this script) ---
Glue version:        4.0+ (Iceberg support)
Job parameters:
  --datalake-formats            iceberg
  --conf                        spark.sql.catalog.glue_catalog=org.apache.iceberg.spark.SparkCatalog
                                 --conf spark.sql.catalog.glue_catalog.warehouse=s3://<bucket>/warehouse/
                                 --conf spark.sql.catalog.glue_catalog.catalog-impl=org.apache.iceberg.aws.glue.GlueCatalog
                                 --conf spark.sql.catalog.glue_catalog.io-impl=org.apache.iceberg.aws.s3.S3FileIO
                                 --conf spark.sql.extensions=org.apache.iceberg.spark.extensions.IcebergSparkSessionExtensions
  --RAW_S3_PATH                 s3://<bucket>/bea/sqgdp_data/SQGDP/*__ALL_AREAS_*.csv
  --ICEBERG_DATABASE            bea
  --ICEBERG_TABLE               sqgdp_state_gdp
IAM: glue:*, s3:GetObject on RAW_S3_PATH, s3:{Get,Put,List}Object on the
     warehouse path, and glue:*Table/*Database on ICEBERG_DATABASE.
---------------------------------------------------------------------
"""

import sys

from awsglue.context import GlueContext
from awsglue.job import Job
from awsglue.utils import getResolvedOptions
from pyspark.context import SparkContext
from pyspark.sql import functions as F
from pyspark.sql import types as T

args = getResolvedOptions(
    sys.argv,
    ["JOB_NAME", "RAW_S3_PATH", "ICEBERG_DATABASE", "ICEBERG_TABLE"],
)

sc = SparkContext()
glueContext = GlueContext(sc)
spark = glueContext.spark_session
job = Job(glueContext)
job.init(args["JOB_NAME"], args)

CATALOG = "glue_catalog"
FQ_TABLE = f"{CATALOG}.{args['ICEBERG_DATABASE']}.{args['ICEBERG_TABLE']}"

ID_COLS = [
    "GeoFIPS",
    "GeoName",
    "Region",
    "TableName",
    "LineCode",
    "IndustryClassification",
    "Description",
    "Unit",
]


def read_raw(path: str):
    """Read the raw SQGDP CSV(s) as all-string columns (BEA mixes numeric
    and note-text in the same columns via footer rows -- cast explicitly
    downstream instead of relying on schema inference)."""
    return (
        spark.read.option("header", True)
        .option("quote", '"')
        .option("escape", '"')
        .csv(path)
        .withColumn("source_file", F.input_file_name())
    )


def unpivot(df):
    """Turn each YYYY:Qn column into a (quarter_col, value) row pair."""
    quarter_cols = [
        c for c in df.columns if c not in ID_COLS + ["source_file"]
    ]
    stack_expr = ", ".join(f"'{c}', `{c}`" for c in quarter_cols)
    n = len(quarter_cols)
    return df.select(
        *ID_COLS,
        "source_file",
        F.expr(f"stack({n}, {stack_expr}) as (quarter_col, raw_value)"),
    )


def standardize(df):
    """Clean, cast, and derive the sqgdp_state_gdp column set."""
    df = df.filter(F.col("LineCode").isNotNull())

    # BEA's export has a stray leading space before the quoted GeoFIPS value,
    # so quotes come through literally -- strip them, then drop footer rows
    # (source notes / footnote text) that don't parse as a digit code.
    df = df.withColumn(
        "geo_fips", F.regexp_replace(F.trim(F.col("GeoFIPS")), '"', "")
    ).filter(F.col("geo_fips").rlike(r"^\d+$"))

    year_q = F.regexp_extract(F.col("quarter_col"), r"(\d{4}):Q([1-4])", 1)
    quarter = F.regexp_extract(F.col("quarter_col"), r"(\d{4}):Q([1-4])", 2)

    return df.select(
        F.col("geo_fips"),
        F.trim(F.col("GeoName")).alias("geo_name"),
        F.col("Region").cast(T.IntegerType()).alias("region"),
        F.col("TableName").alias("table_name"),
        F.col("LineCode").cast(T.IntegerType()).alias("line_code"),
        F.col("IndustryClassification").alias("industry_classification"),
        F.trim(F.col("Description")).alias("description"),
        F.trim(F.col("Unit")).alias("unit"),
        year_q.cast(T.IntegerType()).alias("year"),
        quarter.cast(T.IntegerType()).alias("quarter"),
        F.to_date(
            F.format_string(
                "%s-%02d-01", year_q, (quarter.cast(T.IntegerType()) - 1) * 3 + 1
            )
        ).alias("period_date"),
        F.col("raw_value").cast(T.DoubleType()).alias("value"),
        F.col("source_file"),
        F.current_timestamp().alias("ingested_at"),
    )


def ensure_table_exists():
    spark.sql(
        f"""
        CREATE TABLE IF NOT EXISTS {FQ_TABLE} (
            geo_fips                 string,
            geo_name                 string,
            region                   int,
            table_name               string,
            line_code                int,
            industry_classification  string,
            description              string,
            unit                     string,
            year                     int,
            quarter                  int,
            period_date              date,
            value                    double,
            source_file              string,
            ingested_at              timestamp
        )
        USING iceberg
        PARTITIONED BY (table_name, years(period_date))
        """
    )


def merge_into_iceberg(standardized_df):
    standardized_df.createOrReplaceTempView("sqgdp_updates")
    spark.sql(
        f"""
        MERGE INTO {FQ_TABLE} t
        USING sqgdp_updates s
        ON  t.table_name = s.table_name
        AND t.geo_fips    = s.geo_fips
        AND t.line_code   = s.line_code
        AND t.period_date = s.period_date
        WHEN MATCHED THEN UPDATE SET *
        WHEN NOT MATCHED THEN INSERT *
        """
    )


def main():
    raw = read_raw(args["RAW_S3_PATH"])
    standardized = standardize(unpivot(raw))

    ensure_table_exists()
    merge_into_iceberg(standardized)

    job.commit()


if __name__ == "__main__":
    main()
