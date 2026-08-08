"""Load a single SQGDP table/geo CSV as a tidy pandas DataFrame."""

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


def load_sqgdp(table: int | str, geo: str, data_dir: Path = DATA_DIR) -> pd.DataFrame:
    """
    Load SQGDP{table}_{geo}_*.csv as a tidy long-format DataFrame: one row
    per (LineCode, quarter), with columns id_cols + ["period", "value"].

    table: table number/name, e.g. 2 or "SQGDP2".
    geo: 2-letter state code, "US", "DC", or a BEA region code (e.g. "FWST").
    """
    table_name = f"SQGDP{table}" if not str(table).upper().startswith("SQGDP") else str(table).upper()
    geo = geo.upper()

    matches = sorted(data_dir.glob(f"{table_name}_{geo}_*.csv"))
    if not matches:
        raise FileNotFoundError(f"No file found for {table_name} / {geo} in {data_dir}")

    raw = pd.read_csv(matches[0])

    # Trailing footer rows (source notes, footnote reference, etc.) have no LineCode.
    raw = raw.dropna(subset=["LineCode"]).copy()

    # BEA's export has a stray leading space before the quoted GeoFIPS value,
    # which breaks CSV quote-stripping, so the quotes come through literally.
    raw["GeoFIPS"] = raw["GeoFIPS"].str.strip().str.strip('"')
    raw["Description"] = raw["Description"].str.strip()
    raw["LineCode"] = raw["LineCode"].astype(int)

    period_cols = [c for c in raw.columns if c not in ID_COLS]

    tidy = raw.melt(
        id_vars=ID_COLS,
        value_vars=period_cols,
        var_name="quarter",
        value_name="value",
    )
    tidy["period"] = pd.PeriodIndex(tidy["quarter"].str.replace(":", "", regex=False), freq="Q")
    tidy["value"] = pd.to_numeric(tidy["value"], errors="coerce")
    tidy = tidy.drop(columns="quarter")

    return tidy.sort_values(["LineCode", "period"]).reset_index(drop=True)


if __name__ == "__main__":
    df = load_sqgdp(2, "CA")
    print(df.head())
