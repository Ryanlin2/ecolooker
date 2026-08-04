# SQGDP — BEA State Quarterly GDP Data

Raw data downloaded from the U.S. Bureau of Economic Analysis (BEA) Regional
Economic Accounts, "SQGDP" (State Quarterly Gross Domestic Product) series.
Covers **2005:Q1 – 2026:Q1**, quarterly, seasonally adjusted at annual rates.

`
https://apps.bea.gov/regional/downloadzip.htm?_gl=1*1beleys*_ga*MTY3MDM4NTM1Ny4xNzgxMzYzMjA4*_ga_J4698JNNFT*czE3ODU4ODM4ODAkbzMkZzEkdDE3ODU4ODM5MjIkajE4JGwwJGgw
`

## Tables included

Each `SQGDP{n}` prefix is a distinct BEA table, exported as one CSV per
state/region plus a combined `_ALL_AREAS` file:

| Prefix | Table name | Unit(s) |
|---|---|---|
| `SQGDP1` | State quarterly GDP summary | Millions of chained 2017 $, quantity index, millions of current $ |
| `SQGDP2` | Gross domestic product (GDP) by state | Millions of current dollars |
| `SQGDP8` | Chain-type quantity indexes for real GDP by state (2017=100.0) | Index |
| `SQGDP9` | Real GDP by state | Millions of chained 2017 dollars |
| `SQGDP11` | Contributions to percent change in real GDP | Percent change / percentage points |

Line-item definitions for each table (what each `LineCode` means) are in the
matching `SQGDP{n}__definition.xml` file. Data caveats/footnotes (disclosure
suppression, methodology notes, last-updated date) are in
`SQGDP{n}__Footnotes.html`.

## File naming

```
SQGDP{table}_{AREA}_2005_2026.csv
SQGDP{table}__ALL_AREAS_2005_2026.csv   (all states/regions in one file)
SQGDP{table}__definition.xml            (line code definitions)
SQGDP{table}__Footnotes.html            (footnotes)
```

`{AREA}` is a 2-letter state postal code (e.g. `CA`, `TX`), `US` for the
national total, `DC` for D.C., or a BEA multi-state region code:

| Code | Region |
|---|---|
| `NENG` | New England |
| `MEST` | Mideast |
| `GLAK` | Great Lakes |
| `PLNS` | Plains |
| `SEST` | Southeast |
| `SWST` | Southwest |
| `RKMT` | Rocky Mountain |
| `FWST` | Far West |

Note: `SQGDP1` only ships as `_ALL_AREAS` (no per-state files exist for that
table in this folder).

## CSV format

Wide/long hybrid: one row per (area, line item), one column per quarter.

```
GeoFIPS, GeoName, Region, TableName, LineCode, IndustryClassification,
Description, Unit, 2005:Q1, 2005:Q2, ..., 2026:Q1
```

- **GeoFIPS / GeoName** — area FIPS code and name (e.g. `"06000"`, `"California"`)
- **Region** — BEA region number code
- **LineCode** / **Description** — which statistic/industry the row holds (see the table's `_definition.xml`)
- **IndustryClassification** — NAICS code(s) for that line, where applicable
- **Unit** — unit of the values in that row (varies by LineCode within the same file, e.g. `SQGDP1` mixes dollar levels and index values)
- Remaining columns — one value per quarter, `YYYY:Qn`

Quarterly columns are largely consistent across files, though some per-area
files start at `2005:Q2` rather than `2005:Q1` (e.g. `SQGDP11_CA`) — check the
header row rather than assuming a fixed column count.

## Source

BEA Regional Economic Accounts, series SQGDP. Last updated per footnotes:
June 25, 2026 (new statistics for 2026:Q1).
