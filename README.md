# ecolooker
https://www.ecolooker.com/

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

Two of the three sources are full pipelines end to end; IMF currently stops
at the fetch function (see [`lambda/README.md`](lambda/README.md)).

```
      ┌─────────────┐        ┌─────────────┐        ┌─────────────┐
      │    CFPB     │        │     BEA     │        │     IMF     │
      │ complaints  │        │  state GDP  │        │ macro data  │
      │  bulk CSV   │        │ Regional API│        │ DataMapper  │
      └──────┬──────┘        └──────┬──────┘        └──────┬──────┘
             ▼                      ▼                      ▼
   ┌──────────────────┐   ┌──────────────────┐   ┌───────────────────┐
   │ AWS Glue (Spark)  │   │ AWS Glue: Python  │   │  AWS Lambda        │
   │ clean → Iceberg   │   │ Shell download →  │   │  (packaged `imf`)  │
   │ MERGE upsert      │   │ Spark → Iceberg   │   │                    │
   │ cfpb/glue_jobs    │   │ bea/glue          │   │  lambda/imf        │
   └─────────┬─────────┘   └─────────┬─────────┘   └─────────┬──────────┘
             ▼                      ▼                        ┊
   ┌───────────────────┐  ┌───────────────────┐    not yet wired further —
   │ Athena SQL views   │  │ Athena SQL views   │    no landing job, view,
   │ anomaly detection,  │  │ (bea/athena) — GDP │    or dashboard consumes
   │ seasonality, HHI    │  │ growth/contribution│    it yet
   │ (cfpb/glue_views)   │  │ views              │
   └─────────┬───────────┘  └─────────┬──────────┘
             ▼                        ▼
   ┌───────────────────┐  ┌────────────────────┐
   │ Lambda API layer   │  │ Lambda API layer    │
   │ (cfpb/lambda)       │  │ (bea/lambda)         │
   └─────────┬───────────┘  └─────────┬────────────┘
             └────────────┬───────────┘
                           ▼
              ┌────────────────────────┐
              │  ecolooker-webapp        │
              │  Next.js dashboards      │
              │  (cfpb-complaints,        │
              │   us-industry-gdp)        │
              └────────────────────────┘
```

`glue/rollback.py` is a standalone safety utility: it rolls any Iceberg table
in the warehouse back to a prior snapshot if a bad upsert lands corrupt data.
Terraform for the BEA side of this (Glue jobs, Lambda endpoints) lives under
[`bea/terraform/`](bea/terraform).

## Repo layout

| Directory | Contents |
|---|---|
| [`cfpb/`](cfpb) | Glue ingestion job (raw CSV → cleaned Iceberg table via `MERGE`), Athena SQL views for anomaly detection/seasonality/issue concentration, and the Lambda that serves them to the webapp |
| [`bea/`](bea) | State Quarterly GDP: Glue download + Iceberg load, Athena views, Lambda API, and the Terraform that deploys all of it |
| [`lambda/imf/`](lambda) | Packaged Python module + Lambda layer build for IMF DataMapper ingestion — fetch-only, not yet wired into a landing job or dashboard |
| [`glue/`](glue) | Standalone Iceberg snapshot-rollback utility |
| [`ecolooker-webapp/`](ecolooker-webapp) | Next.js 16 / React 19 / Tailwind v4 frontend that renders the dashboards |

Each directory has its own README with implementation detail — the CFPB Glue
job and views in particular include the full anomaly-detection methodology.

## Running the webapp locally

```bash
cd ecolooker-webapp/ecolooker
npm install
npm run dev      # http://localhost:3000
```

Requires `CFPB_API_URL` and `SQGDP_API_URL` pointed at the Lambda endpoints in
[`cfpb/lambda`](cfpb/lambda) and [`bea/lambda`](bea/lambda) — both dashboard
pages fetch live data server-side and will throw without them. See
[`ecolooker-webapp/ecolooker/README.md`](ecolooker-webapp/ecolooker/README.md)
for the full data layer, component breakdown, and how to add a new dashboard.

## Stack

- **Data pipelines**: AWS Glue (PySpark), Apache Iceberg, Athena, AWS Lambda, pandas
- **Frontend**: Next.js (App Router), React, TypeScript, Tailwind CSS, Recharts

## License

[MIT](LICENSE)
