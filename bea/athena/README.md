# bea/athena

Athena SQL views backing the "US Industry GDP" dashboard
(`ecolooker-webapp/.../dashboards/us-industry-gdp`), queried live by
[`bea/lambda/sqgdp_main_metrics.py`](../lambda).

## sqgdp_views.sql

All views read from `bea.sqgdp_state_gdp` — the Iceberg table populated by
[`bea/glue/sqgdp_iceberg_job.py`](../glue) — filtered to `table_name =
'SQGDP9'` ("Real GDP by state", millions of chained 2017 dollars, by
industry). That's the table the dashboard's chained-dollar figures are
modeled on; see [`bea/sqgdp_data/README.md`](../sqgdp_data) for the full
SQGDP table/line-code reference.

Every view is quarter-agnostic (one row per entity per quarter) — the
consumer picks the quarter it wants, typically the latest via
`WHERE period_date = (SELECT MAX(period_date) FROM <view>)`.

| View | What it computes |
|---|---|
| `v_us_state_fips` | Static lookup: 2-digit state FIPS → USPS code → name, plus a `'00'` / `'US'` / `"United States"` row for the national total. Not queried directly by the endpoint; used by other views to filter out BEA's 8 census-region aggregate rows (New England, Mideast, ...), which are neither a state/DC nor the national total. |
| `v_sqgdp_state_totals_quarterly` | Per-state (+ national) all-industry-total real GDP by quarter, with QoQ and YoY `%` change via `LAG(1)`/`LAG(4)` windows partitioned by `geo_fips`. |
| `v_sqgdp_state_leading_industry_quarterly` | Per-state (+ national) top real-GDP industry each quarter, picked via `ROW_NUMBER() OVER (PARTITION BY geo_fips, period_date ORDER BY value DESC)` across the 20 leaf NAICS-level line codes (excludes subtotal codes like "Private industries" or "Manufacturing" so leaves don't get counted twice against their own children). |
| `v_us_state_gdp` | Joins the two views above (`INNER JOIN` on FIPS, `LEFT JOIN` on leading industry) into the combined per-state row the map, ranking table, and "fastest growing" table read. Includes a `state_fips = '00'` national-total row — filter with `WHERE state_fips <> '00'` for states-only views. |
| `v_us_national_gdp` | National real GDP total by quarter with QoQ/YoY `%` change. Feeds the national GDP metric cards. |
| `v_us_industry_gdp` | National GDP-by-industry mix by quarter: `share_pct` of the national total plus QoQ/YoY `%` change per industry. Feeds the "GDP by industry" table and the "leading industry" metric card. |

The leaf industry line codes used throughout (`3, 6, 10, 11, 12, 34, 35, 36,
45, 51, 56, 60, 64, 65, 69, 70, 76, 79, 82, 83`) sum to line code `1` (all
industry total); see the file's header comment and `SQGDP9__definition.xml`
in `sqgdp_data/` for the code-to-industry-name mapping.

Example queries for each dataset (as the Lambda endpoint would run them) are
included at the bottom of the file.
