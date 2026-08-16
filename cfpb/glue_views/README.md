# cfpb/glue_views

Athena SQL views built on top of the Iceberg table (`"cfpb-complaints".complaints`)
that [`cfpb/glue_jobs/cfpb_complaints_upsert.py`](../glue_jobs/README.md) upserts into.
Every view here reads from `vw_cfpb_base`, never from the base table directly, so a
schema change only has to be absorbed once.

Two of the views below (`vw_volume_anomaly_product_issue`, `vw_geo_state_anomaly`) are
rolling z-score anomaly detectors. The shared math — trailing window, baseline
mean/stddev, z-score, the 3σ threshold — is derived in full in
[`anomoly_detection.md`](anomoly_detection.md); this file doesn't repeat that derivation,
only the parameters each view plugs in (window length, partition key, stddev flavor,
volume floor).

## `views.sql` vs. the individual `vw_*.sql` files

`views.sql` is a **design library**, not a deployment manifest: it's a single file with
28 candidate views (00 base + 27 metrics, grouped into 8 sections — volume/velocity,
composition/taxonomy, geographic, channel/population, response performance, comparative
benchmarks, text/narrative signals, cross-field signals) written as a reference spec.
Only **8** of those 28 have actually been built out as standalone, individually deployed
Athena views — the `vw_*.sql` files in this directory — and where a deployed file exists,
**its SQL is the source of truth**, not `views.sql`. Two of the eight have diverged
meaningfully from their `views.sql` draft (noted below); the rest match closely modulo
Trino's normalized `CREATE VIEW` formatting.

The other 20 views described in `views.sql` (`vw_geo_state_monthly`,
`vw_channel_mix_monthly`, `vw_timely_response_rate`, `vw_monetary_relief_rate`,
`vw_attention_index`, etc.) are documented there but not deployed — treat that portion of
`views.sql` as a backlog/spec, not as running SQL.

| Deployed view | File | `views.sql` draft # | Diverges from draft? |
|---|---|---|---|
| `vw_cfpb_base` | `vw_cfpb_base.sql` | 00 | Yes — reads an already-cleaned Iceberg schema, not raw space-delimited CSV columns |
| `vw_volume_daily` | `vw_volume_daily.sql` | 01 | No |
| `vw_volume_anomaly_product_issue` | `vw_volume_anomaly_product_issue.sql` | 02 | No |
| `vw_volume_seasonality` | `vw_volume_seasonality.sql` | 04 | No |
| `vw_mix_product_monthly` | `vw_product_issue_heatmap.sql` (filename mismatch — see below) | 05 | No (logic matches; file/name mismatch only) |
| `vw_fastest_growing_issues` | `vw_fastest_growing_issues.sql` | 06 | Yes — pace-adjusted expected-vs-actual model, not naive MoM growth |
| `vw_issue_concentration_hhi` | `vw_issue_concentration_hhi.sql` | 08 | No |
| `vw_geo_state_anomaly` | `vw_geo_state_anomaly.sql` | 11 | Yes — daily/180-day-trailing + sample stddev + volume floor, not monthly/6-month + population stddev |

## `vw_cfpb_base.sql`

Normalizing foundation view every other view reads from. `SELECT ... FROM
"cfpb-complaints".complaints`, ordered by `date_received ASC`.

Unlike the `views.sql` draft — which assumes it's reading a raw, space-delimited-column
table (`"complaint id"`, `"sub-product"`, `"timely response?"`) straight off the CFPB
CSV — the deployed view reads columns that are **already snake_case**
(`complaint_id`, `sub_product`, `sub_issue`, `timely_response_flag`, `record_hash`, ...).
That's because it sits on top of the Iceberg table `cfpb_complaints_upsert.py` produces,
not the raw export, so the base-view logic here is column renaming for the *pre-Glue-job*
schema in `views.sql` vs. mostly derivation/defaulting for the *post-Glue-job* schema in
the deployed file.

| Derived column | Logic |
|---|---|
| `missing_complaint_id` | `complaint_id IS NULL` |
| `day_received` / `week_received` / `month_received` | `date_trunc('day'\|'week'\|'month', date_received)` |
| `product` / `sub_product` / `issue` / `sub_issue` | `COALESCE(NULLIF(TRIM(...), ''), 'UNKNOWN')` |
| `state` | `UPPER(TRIM(state))` |
| `zip3` | First 3 digits of `zip_code` if it matches `^[0-9]{3}`, else `NULL` |
| `routing_lag_days` | `date_diff('day', date_received, date_sent_to_company)` |
| `has_narrative` | `COALESCE(has_narrative, narrative IS NOT NULL AND TRIM(narrative) <> '')` — prefers an upstream precomputed value, falls back to computing it |
| `is_monetary_relief` / `is_nonmonetary_relief` / `is_in_progress` | `company_response_to_consumer` equals the corresponding CFPB response category |
| `is_servicemember` / `is_older_american` | `tags LIKE '%Servicemember%'` / `'%Older American%'` |

`record_hash` is passed through unchanged (same content hash the upsert job computes,
useful if a consumer wants to detect that a row changed between two view reads).

## `vw_volume_daily.sql`

**Question:** is today's total complaint volume unusual relative to its own recent trend?

Reads `vw_cfpb_base`, groups to one row per `day_received`, `COUNT(*)`. Adds:

- `avg_7d` / `avg_30d` — rolling averages (`AVG(...) OVER (ORDER BY day_received ROWS
  BETWEEN {6,29} PRECEDING AND CURRENT ROW)`)
- `dod_change` — `complaints - LAG(complaints, 1)`
- `wow_change` / `wow_pct_change` — `complaints - LAG(complaints, 7)`, and that delta as
  a percentage of the prior week's value

No anomaly flag here — this is the raw heartbeat feed the other views build baselines
from and against which a human eyeballs whether the 7d average is drifting above the 30d
average.

Consumed by [`cfpb/lambda/cfpb_mega.py`](../lambda/README.md) as dataset `volume_daily`.

## `vw_volume_anomaly_product_issue.sql`

**Question:** is one (product, issue) pair's complaint volume statistically unusual
today, relative to its own history?

This is the canonical implementation of the rolling z-score detector described in
[`anomoly_detection.md`](anomoly_detection.md):

| Parameter | Value |
|---|---|
| Series granularity | `(day_received, product, issue)` — one series per product × issue pair |
| Trailing window | 28 days, `ROWS BETWEEN 28 PRECEDING AND 1 PRECEDING` (today excluded) |
| Partition | `product, issue` |
| Stddev flavor | `STDDEV_POP` |
| Threshold | `|z_score| >= 3` (and `baseline_std > 0`, to avoid divide-by-zero) → `is_anomaly` |

Reads `vw_cfpb_base`, groups by `(day_received, product, issue)` for the daily count,
then window-aggregates over that.

Consumed by `cfpb_mega.py` as dataset `volume_anomaly_product_issue`, server-side
filtered there to `ABS(z_score) >= 3 AND day_received >= this year`.

## `vw_volume_seasonality.sql`

**Question:** what's the expected shape of complaint volume by day-of-week and
month-of-year, so a raw day-to-day comparison doesn't produce false alarms?

Reads `vw_cfpb_base`, daily counts, grouped by `day_of_week(day_received)` (1 = Monday)
and `month(day_received)`, averaged (`avg_complaints`) with a support count
(`days_observed`). Used to calibrate alert thresholds — e.g. distinguishing "Mondays
always run hot" from a genuine anomaly.

Consumed by `cfpb_mega.py` as dataset `volume_seasonality`.

## `vw_product_issue_heatmap.sql` (defines `vw_mix_product_monthly` — filename mismatch)

**This file's `CREATE VIEW` statement actually defines `"cfpb-complaints".vw_mix_product_monthly`**,
matching draft view 05 in `views.sql` (product/sub-product monthly mix and share) — not
draft view 07, `vw_product_issue_heatmap` (product × issue monthly counts and
`pct_of_product`), which its filename implies.

**Question actually answered by this SQL:** how is complaint volume splitting across
product/sub-product each month, and is that split shifting?

Reads `vw_cfpb_base`, groups by `(month_received, product, sub_product)`, computes each
combination's `share_pct` of that month's total (`SUM(complaints) OVER (PARTITION BY
month_received)`), then `share_pct_change_mom` via `LAG` partitioned by
`(product, sub_product)`.

Consumed by `cfpb_mega.py` as dataset `mix_product_monthly` (`view: vw_mix_product_monthly`)
— consistent with what this file actually creates.

**Note:** `cfpb_mega.py`'s `DATASETS` registry *also* declares a separate dataset,
`product_issue_heatmap`, pointed at a view named `vw_product_issue_heatmap`
(`view: vw_product_issue_heatmap`, product × issue counts, not product × sub-product).
No file in this directory defines that view — either it exists in Athena without its
defining SQL checked into this repo, or this file was meant to hold both/was overwritten.
Anyone touching this needs to reconcile the filename, or add the missing
`vw_product_issue_heatmap` definition, before trusting `cfpb_mega.py`'s
`product_issue_heatmap` dataset.

## `vw_fastest_growing_issues.sql`

**Question:** which issue/sub-issue categories are growing fastest *relative to their
own expected pace this month* — not just which grew the most since last month's total?

This diverges substantially from the `views.sql` draft (06), which does a naive
month-over-month percentage change on complete-month totals. The deployed version instead
pace-adjusts for a partial current month:

1. `data_through_date` — the max `day_received` across the whole base view (how far into
   the current month the data actually extends).
2. Monthly counts per `(month_received, issue, sub_issue)`.
3. `days_elapsed` — for the current data month, days from month start through
   `data_through_date`; for historical months, the full days-in-month.
4. `avg_daily_complaints = complaints / days_elapsed`.
5. `prev_avg_daily_complaints` — the same rate for the prior month, via `LAG` partitioned
   by `(issue, sub_issue)`.
6. `expected_complaints_to_date = prev_avg_daily_complaints * days_elapsed` — what this
   month "should" have produced by now if it were running at last month's daily rate.
7. `growth_vs_expected_pct = 100 * (complaints - expected_complaints_to_date) /
   expected_complaints_to_date`.
8. Filtered to consecutive calendar months only, `prev_complaints >= 10` (volume floor),
   and `complaints > expected_complaints_to_date` (positive growth only).
9. `growth_rank` — `RANK() OVER (PARTITION BY month_received ORDER BY
   growth_vs_expected_pct DESC)`.

This avoids the naive version's failure mode: comparing a half-elapsed current month
against a complete prior month would make every category look like it's shrinking.

Consumed by `cfpb_mega.py` as dataset `fastest_growing_issues`.

## `vw_issue_concentration_hhi.sql`

**Question:** within a product, are complaints concentrated on one dominant issue (a
single fixable root cause) or spread diffusely across many (a systemic problem)?

Herfindahl-Hirschman Index. Reads `vw_cfpb_base`, computes each issue's `share_pct`
within its product for the month (`100 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY
month_received, product)`), then `hhi = ROUND(SUM(share_pct * share_pct), 0)` grouped by
`(month_received, product)`. HHI = 10,000 means one issue holds 100% of that product's
complaints; lower values mean the complaints are more spread out. Matches the `views.sql`
draft (08) exactly.

Consumed by `cfpb_mega.py` as dataset `issue_concentration_hhi`.

## `vw_geo_state_anomaly.sql`

**Question:** did a state's complaint volume spike relative to *that state's own*
history — not relative to other states, and not just because it's a large state?

Also a rolling z-score detector (see [`anomoly_detection.md`](anomoly_detection.md) for
the general math), but tuned differently from `vw_volume_anomaly_product_issue` and from
its own `views.sql` draft (11):

| Parameter | `views.sql` draft (11) | Deployed (this file) |
|---|---|---|
| Series granularity | Monthly per state | **Daily** per state (`day_received`) |
| Trailing window | 6 preceding months | **180 preceding days** (~6 months, but on daily counts) |
| Stddev flavor | `STDDEV_POP` | **`STDDEV_SAMP`** |
| Volume floor | None | **`complaints >= 10`** required, in addition to `z_score >= 3` |
| Output columns | `baseline_avg`, `is_spike` | `expected_complaints`, `is_spike` (renamed, same meaning) |

Reads `vw_cfpb_base` filtered to non-null/non-empty `state`, daily counts per state, then
window-aggregates with `PARTITION BY state ORDER BY day_received ROWS BETWEEN 180
PRECEDING AND 1 PRECEDING`. The volume floor (`complaints >= 10`) exists because a small
state can go from 1 complaint/day to 3 complaints/day and produce a huge but meaningless
z-score; `STDDEV_SAMP` (n-1 denominator) is a small conservative shift from the
`STDDEV_POP` used everywhere else in this library.

Consumed by `cfpb_mega.py` as dataset `geo_state_anomaly`, server-side filtered there to
`z_score >= 3 AND complaints >= 10 AND day_received >= this year` (the `complaints >= 10`
filter is applied twice — once in the view's `is_spike` flag, once again by the Lambda's
`WHERE` — which is redundant but harmless).
