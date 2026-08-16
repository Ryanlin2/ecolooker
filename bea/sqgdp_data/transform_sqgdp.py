"""
Standardize raw SQGDP CSV exports into the tidy schema used by the
`sqgdp_state_gdp` Iceberg table.

This generalizes query.py's melt logic (one table/geo at a time, kept as
pandas Period) into the flat, Iceberg-friendly shape: every quarter column
becomes a (year, quarter, period_date) row, and lineage columns
(source_file, ingested_at) are attached for traceability across re-ingests.

Meant for local/dev use (e.g. validating a file before wiring up the Glue
job, or a small backfill) — the Glue job in bea/glue/sqgdp_iceberg_job.py
does the equivalent transform in Spark for production volumes.
"""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

DATA_DIR = Path(__file__).parent / "SQGDP"

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

ICEBERG_COLUMNS = [
    "geo_fips",
    "geo_name",
    "region",
    "table_name",
    "line_code",
    "industry_classification",
    "description",
    "unit",
    "year",
    "quarter",
    "period_date",
    "value",
    "source_file",
    "ingested_at",
]


def transform_sqgdp_file(path: Path) -> pd.DataFrame:
    """
    Load one SQGDP{table}_{geo}_*.csv (or a __ALL_AREAS file) and return it
    standardized to the sqgdp_state_gdp Iceberg schema.
    """
    raw = pd.read_csv(path, dtype=str)

    # Trailing footer rows (source notes, footnote reference, etc.) have no LineCode.
    raw = raw.dropna(subset=["LineCode"]).copy()

    # BEA's export has a stray leading space before the quoted GeoFIPS value,
    # which breaks CSV quote-stripping, so the quotes come through literally.
    raw["GeoFIPS"] = raw["GeoFIPS"].str.strip().str.strip('"')

    # Belt-and-suspenders: drop any remaining non-data rows that slipped past
    # the LineCode check (GeoFIPS should always be all-digit).
    raw = raw[raw["GeoFIPS"].str.fullmatch(r"\d+")].copy()

    raw["GeoName"] = raw["GeoName"].str.strip()
    raw["Description"] = raw["Description"].str.strip()
    raw["Unit"] = raw["Unit"].str.strip()
    raw["LineCode"] = raw["LineCode"].astype(int)
    raw["Region"] = pd.to_numeric(raw["Region"], errors="coerce").astype("Int64")

    period_cols = [c for c in raw.columns if c not in ID_COLS]

    tidy = raw.melt(
        id_vars=ID_COLS,
        value_vars=period_cols,
        var_name="quarter_col",
        value_name="value",
    )

    year_quarter = tidy["quarter_col"].str.extract(r"(?P<year>\d{4}):Q(?P<quarter>[1-4])")
    tidy["year"] = year_quarter["year"].astype(int)
    tidy["quarter"] = year_quarter["quarter"].astype(int)
    tidy["period_date"] = pd.PeriodIndex(
        tidy["year"].astype(str) + "Q" + tidy["quarter"].astype(str), freq="Q"
    ).to_timestamp()
    tidy["value"] = pd.to_numeric(tidy["value"], errors="coerce")

    tidy["source_file"] = path.name
    tidy["ingested_at"] = datetime.now(timezone.utc)

    tidy = tidy.rename(
        columns={
            "GeoFIPS": "geo_fips",
            "GeoName": "geo_name",
            "Region": "region",
            "TableName": "table_name",
            "LineCode": "line_code",
            "IndustryClassification": "industry_classification",
            "Description": "description",
            "Unit": "unit",
        }
    )

    return tidy[ICEBERG_COLUMNS].sort_values(
        ["table_name", "geo_fips", "line_code", "period_date"]
    ).reset_index(drop=True)


def transform_sqgdp_directory(
    data_dir: Path = DATA_DIR, pattern: str = "*__ALL_AREAS_*.csv"
) -> pd.DataFrame:
    """
    Transform every file matching `pattern` under `data_dir` and concatenate
    into one standardized DataFrame. Defaults to the five __ALL_AREAS files
    (one per SQGDP table), which already contain every geo for that table.
    """
    matches = sorted(data_dir.glob(pattern))
    if not matches:
        raise FileNotFoundError(f"No files matching {pattern!r} in {data_dir}")

    return pd.concat(
        (transform_sqgdp_file(path) for path in matches), ignore_index=True
    )


if __name__ == "__main__":
    df = transform_sqgdp_directory()
    print(df.head())
    print(df.dtypes)
    print(f"\n{len(df):,} rows across {df['table_name'].nunique()} tables")
