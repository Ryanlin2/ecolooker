# SQGDP Data (BEA State Quarterly GDP)

Raw CSV exports from the BEA (Bureau of Economic Analysis) Regional Data API,
covering **State Quarterly GDP (SQGDP)** tables from 2005:Q1 through 2026:Q1.
Everything lives under `SQGDP/`.

## Tables available

Each table is a different measure of state-level GDP. The number in the
filename (`SQGDP1`, `SQGDP2`, etc.) identifies the table:

| Table | Name | What it measures |
|---|---|---|
| **SQGDP1** | State quarterly GDP summary | 3 lines only: Real GDP (chained 2017 $), Chain-type quantity index, Current-dollar GDP — no industry breakdown |
| **SQGDP2** | GDP by state | Current-dollar GDP ($ millions), broken out by industry |
| **SQGDP8** | Chain-type quantity indexes for real GDP by state (2017=100.0) | Quantity index, broken out by industry |
| **SQGDP9** | Real GDP by state | Real GDP (millions of chained 2017 $), broken out by industry |
| **SQGDP11** | Contributions to percent change in real GDP | Percentage-point contribution of each industry to the quarter's real GDP growth |

SQGDP2/8/9/11 all share the same industry breakdown (`LineCode`), see
"Industry line codes" below. SQGDP1 has only 3 summary lines and no industry
detail.

For the exact definition/methodology text of a table, see its
`SQGDP{n}__definition.xml`. For data caveats and revision notes, see
`SQGDP{n}__Footnotes.html`.

## File naming

```
SQGDP{table}_{geo}_{startyear}_{endyear}.csv
SQGDP{table}__ALL_AREAS_{startyear}_{endyear}.csv   (all geos in one file)
SQGDP{table}__definition.xml                        (line code definitions)
SQGDP{table}__Footnotes.html                         (methodology notes)
```

- `{geo}` is a 2-letter state postal code (`CA`, `TX`, ...), `US` for the
  national total, `DC` for D.C., or a BEA region code (see below).
- The `__ALL_AREAS` file for a table contains the same rows as every
  single-geo file for that table concatenated together — use it if you want
  the whole table in one read instead of looping over states.

### Region codes (used instead of a state abbreviation)

| Code | Region |
|---|---|
| NENG | New England |
| MEST | Mideast |
| GLAK | Great Lakes |
| PLNS | Plains |
| SEST | Southeast |
| SWST | Southwest |
| RKMT | Rocky Mountain |
| FWST | Far West |

## CSV column structure

```
GeoFIPS, GeoName, Region, TableName, LineCode, IndustryClassification, Description, Unit, 2005:Q1, 2005:Q2, ..., 2026:Q1
```

- **GeoFIPS / GeoName** — state/region FIPS code and name (e.g. `"06000"`, `"California"`).
- **Region** — BEA region number (1-8) that the geo belongs to (blank for the US total row).
- **LineCode** — the industry/measure code; cross-reference against the
  table's `__definition.xml` to get its label. For SQGDP2/8/9/11, common
  codes include: `1` all industry total, `2` private industries, `83`
  government and government enterprises, `84` federal civilian, `85`
  military, `86` state and local, plus one code per NAICS-based industry
  (agriculture, mining, construction, manufacturing, retail trade, finance
  and insurance, health care, etc.).
- **IndustryClassification** — the NAICS code(s) for that line (e.g. `11`
  for agriculture), or `"..."` for summary lines that aren't a single NAICS
  sector.
- **Description** — human-readable label for the line (has leading/trailing
  spaces and sometimes a footnote marker like `1/` — trim before matching).
- **Unit** — units for the values in that row (e.g. "Millions of current
  dollars", "Quantity index", "Percent change").
- **`YYYY:Qn`** — one column per quarter, 2005:Q1 through 2026:Q1. Values are
  numeric strings; some cells are blank/NA if the geo has no data for that
  quarter/line.

Each state/geo appears as multiple rows in a file — one row per LineCode
(measure or industry).

### Trailing footer rows

Every CSV ends with a few non-data rows after the last data row, e.g.:

```
"Note: See the included footnote file."
"SQGDP1: State quarterly gross domestic product (GDP) summary "
"Last updated: June 25, 2026-- new statistics for 2026:Q1."
"U.S. Bureau of Economic Analysis"
```

Filter these out (e.g. drop rows where `GeoFIPS` doesn't parse as a 5-digit
code) before analyzing.

## Quick recipes

- **Total US real GDP over time**: `SQGDP1__ALL_AREAS_*.csv`, filter
  `GeoName == "United States"` and `LineCode == 1`.
- **A single state's industry mix**: `SQGDP9_{state}_*.csv` (real GDP by
  industry) or `SQGDP2_{state}_*.csv` (current-dollar GDP by industry),
  one row per `LineCode`.
- **What drove a state's growth in a quarter**: `SQGDP11_{state}_*.csv`,
  compare the `LineCode` rows' contribution values for that quarter — `1`
  is the total percent change, the other lines sum (approximately) to it.
- **Compare growth rates across industries**: use `SQGDP8` (quantity index,
  2017=100) rather than `SQGDP2`/`SQGDP9` dollar levels, since it's already
  normalized.
