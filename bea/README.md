# bea

Ingestion and analysis of state-level GDP data from the
[BEA (Bureau of Economic Analysis) Regional Data API](https://apps.bea.gov/api/signup/).

```
bea/
├── sqgdp_data/           # raw CSV exports + local/notebook exploration
│   ├── SQGDP/            # raw CSV exports, one file per table/geo
│   ├── query.py          # loads a single SQGDP table/geo CSV into a tidy DataFrame
│   ├── transform_sqgdp.py # local/pandas equivalent of bea/glue/sqgdp_iceberg_job.py
│   ├── sqgdp.ipynb        # exploratory analysis notebook
│   └── README.md          # full data dictionary: tables, geo/region codes,
│                           # column structure, footer rows, query recipes
├── glue/                 # AWS Glue jobs: download BEA zip -> S3 -> Iceberg
├── athena/                # Athena views (state/national/industry GDP + growth)
├── lambda/                # Lambda handlers backing the "US Industry GDP" dashboard
└── terraform/             # IaC that deploys the above (Glue jobs, Lambda endpoints)
```

See [`sqgdp_data/README.md`](sqgdp_data/README.md) for the full breakdown of
available tables (SQGDP1/2/8/9/11), file naming, column structure, and query
recipes (e.g. "total US real GDP over time", "what drove a state's growth in
a quarter"). `query.py` is the entry point for loading a table into pandas.

## Pipeline

```
apps.bea.gov/regional/zip/SQGDP.zip
        │
        ▼  bea/glue/sqgdp_download_to_s3.py  (Glue Python Shell)
s3://.../bronze/sqgdp/ingestion_date=<ts>/*.csv
        │
        ▼  bea/glue/sqgdp_iceberg_job.py  (Glue Spark ETL)
bea.sqgdp_state_gdp  (Iceberg table, s3://.../silver/sqgdp/)
        │
        ▼  bea/athena/sqgdp_views.sql
bea.v_us_national_gdp / v_us_state_gdp / v_us_industry_gdp
        │
        ▼  bea/lambda/sqgdp_main_metrics.py  (writer)  +  sqgdp_main_metrics_reader.py  (reader)
s3://.../gold/endpoints/sqgdp-main-metrics/datasets.json.gz  →  us-industry-gdp dashboard
```

Each stage is documented in its own README: [`glue/`](glue), [`athena/`](athena),
[`lambda/`](lambda), [`terraform/`](terraform).

`sqgdp_data/query.py` and `transform_sqgdp.py` are the local/pandas equivalent
of the `glue/` scripts — useful for exploring the data in a notebook without
standing up the AWS pipeline.
