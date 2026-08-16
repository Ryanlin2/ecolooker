# cfpb

Ingestion, cleaning, and anomaly detection for the
[CFPB Consumer Complaint Database](https://www.consumerfinance.gov/data-research/consumer-complaints/)
bulk export.

```
cfpb/
├── glue_jobs/    AWS Glue (Spark): download bulk CSV -> clean/validate -> Iceberg MERGE upsert
├── glue_views/    Athena SQL views: daily volume, rolling z-score anomalies, seasonality,
│                  product/issue mix, HHI concentration, fastest-growing issues, geo anomalies
├── lambda/        Lambda: queries the views, caches a gzip JSON payload in S3 for the dashboard
├── data/          Prototyping history — exploratory notebook + a local, gitignored raw CSV sample
└── claude/        Inactive scaffolding — one gitignored test fixture, no pipeline code
```

## Pipeline

```
consumerfinance.gov bulk CSV (~1 GB zipped / ~10 GB CSV)
        │
        ▼  cfpb/glue_jobs/cfpb_complaints_upsert.py   (Glue 5.0 / Spark)
"cfpb-complaints".complaints   (Iceberg table, MERGE upsert on complaint_id)
        │
        ▼  cfpb/glue_views/vw_cfpb_base.sql + vw_*.sql   (Athena views)
vw_volume_daily, vw_volume_anomaly_product_issue, vw_geo_state_anomaly, ...
        │
        ▼  cfpb/lambda/cfpb_mega.py   (Lambda)
s3://.../analytics/datasets.json.gz
        │
        ▼
ecolooker-webapp — CFPB complaints dashboard
```

`glue_jobs/` → `glue_views/` → `lambda/` is the active, end-to-end pipeline. Each stage
has its own README with full implementation detail:

- [`glue_jobs/`](glue_jobs/README.md) — the Glue upsert job, its download/land/clean/merge
  steps, and the full set of row-level cleaning rules.
- [`glue_views/`](glue_views/README.md) — every deployed Athena view, what question each
  answers, and what table/columns it reads. The two rolling z-score anomaly views share a
  methodology derived in full in [`glue_views/anomoly_detection.md`](glue_views/anomoly_detection.md).
- [`lambda/`](lambda/README.md) — `cfpb_mega.py`: queries the views, converts/trims the
  result columns, and writes the cached gzip JSON payload the dashboard reads.

`data/` and `claude/` are not part of the active pipeline:

- [`data/`](data/README.md) — the notebook (`cfpb.ipynb`) where the cleaning rules now
  living in `cfpb_complaints_upsert.py` were originally prototyped, plus a local,
  gitignored raw CSV sample.
- [`claude/`](claude/README.md) — a single gitignored test fixture with no pipeline code;
  appears to be unused scaffolding.

## Downstream

The cached `datasets.json.gz` payload is consumed by the CFPB complaints dashboard in
`ecolooker-webapp`. See the root [`README.md`](../README.md) for how this fits into the
repo's overall three-pipeline architecture; the webapp itself has its own README for
frontend implementation detail.
