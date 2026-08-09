# ecolooker

**ecolooker** turns public economic and consumer-finance data into anomaly
detection and trend dashboards. It's three independent ETL pipelines — each
pulling from a different government data source — feeding a single Next.js
dashboard frontend.

| Source | What it provides |
|---|---|
| [CFPB Consumer Complaint Database](https://www.consumerfinance.gov/data-research/consumer-complaints/) | Complaint volume by product/issue/geography, used for rolling z-score anomaly detection |
| [BEA Regional Data API](https://apps.bea.gov/api/signup/) | State-level quarterly GDP, by industry |
| [IMF DataMapper API](https://www.imf.org/external/datamapper/api/help) | Cross-country macroeconomic indicators (GDP, PPP, etc.) |

## Architecture

```
                 ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
                 │   CFPB      │   │    BEA      │   │    IMF      │
                 │ complaints  │   │ state GDP   │   │ macro data  │
                 │  bulk CSV   │   │  Regional   │   │  DataMapper │
                 └──────┬──────┘   │    API      │   │     API     │
                        │          └──────┬──────┘   └──────┬──────┘
                        ▼                 ▼                 ▼
              ┌───────────────────┐  ┌─────────┐  ┌──────────────────┐
              │  AWS Glue (Spark) │  │  pandas │  │  AWS Lambda       │
              │  clean → Iceberg  │  │  scripts│  │  (packaged `imf`) │
              │  MERGE upsert     │  │         │  │                   │
              │  cfpb/glue_jobs   │  │  bea/   │  │  lambda/imf       │
              └─────────┬─────────┘  └────┬────┘  └─────────┬─────────┘
                        │                 │                 │
                        ▼                 ▼                 ▼
              ┌────────────────────────────────────────────────────┐
              │   Athena SQL views (cfpb/glue_views) — anomaly      │
              │   detection, seasonality, HHI concentration, etc.   │
              └───────────────────────────┬──────────────────────────┘
                                           ▼
                              ┌────────────────────────┐
                              │  ecolooker-webapp        │
                              │  Next.js dashboards +    │
                              │  written reports         │
                              └────────────────────────┘
```

`glue/rollback.py` is a standalone safety utility: it rolls any Iceberg table
in the warehouse back to a prior snapshot if a bad upsert lands corrupt data.

## Repo layout

| Directory | Contents |
|---|---|
| [`cfpb/`](cfpb) | Glue ingestion job (raw CSV → cleaned Iceberg table via `MERGE`) + Athena SQL views for anomaly detection, seasonality, and issue concentration |
| [`bea/`](bea) | State Quarterly GDP data pull + pandas loading utilities |
| [`lambda/imf/`](lambda) | Packaged Python module + Lambda layer build for IMF DataMapper ingestion |
| [`glue/`](glue) | Standalone Iceberg snapshot-rollback utility |
| [`ecolooker-webapp/ecolooker/`](ecolooker-webapp/ecolooker) | Next.js 16 / React 19 / Tailwind v4 frontend that renders the dashboards and written reports |

Each directory has its own README with implementation detail — the CFPB Glue
job and views in particular include the full anomaly-detection methodology.

## Running the webapp locally

```bash
cd ecolooker-webapp/ecolooker
npm install
npm run dev      # http://localhost:3000
```

See [`ecolooker-webapp/ecolooker/README.md`](ecolooker-webapp/ecolooker/README.md)
for how the report/dashboard components are organized and how to publish a
new report.

## Stack

- **Data pipelines**: AWS Glue (PySpark), Apache Iceberg, Athena, AWS Lambda, pandas
- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, Recharts

## License

[MIT](LICENSE)
