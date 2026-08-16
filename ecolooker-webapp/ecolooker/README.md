# Ecolooker

Next.js dashboard frontend for the `ecolooker` repo. Renders two live
dashboards — CFPB consumer complaint anomaly detection and BEA state/industry
GDP — sourced from the Lambda endpoints documented in
[`cfpb/lambda`](../../cfpb/lambda) and [`bea/lambda`](../../bea/lambda).
Robinhood-style dark-surface theme (currently a light teal palette — see
`src/app/globals.css`). Next.js 16 (App Router) + React 19 + Tailwind v4 +
shadcn-style primitives + Recharts + d3-geo.

> **Note:** this is Next.js 16, not the Next.js in most training data — see
> `AGENTS.md` before assuming an API/convention from an older version.

## Run

```bash
npm install
npm run dev      # http://localhost:3000
```

Both dashboard pages fetch live data server-side at request time
(`export const dynamic = "force-dynamic"`) and will throw if their API URL
env var isn't set:

| Env var | Read by | Points at |
|---|---|---|
| `CFPB_API_URL` | `src/lib/cfpb-data.ts` | The CFPB complaint-analytics endpoint (`cfpb/lambda/cfpb_mega.py`) |
| `SQGDP_API_URL` | `src/lib/gdp-data.ts` | The SQGDP main-metrics **reader** endpoint (`bea/lambda/sqgdp_main_metrics_reader.py`) — not the writer/`sqgdp_main_metrics.py` endpoint, which returns write metadata rather than data |

## Route structure

There's no `/reports/[slug]` dynamic route — each dashboard is its own
static route under `src/app/dashboards/`:

| Route | Page | Data source |
|---|---|---|
| `/` | `src/app/page.tsx` | `src/lib/reports.ts` (static registry, drives the home-page report cards) |
| `/dashboards/cfpb-complaints` | `src/app/dashboards/cfpb-complaints/page.tsx` | `getCfpbReport()` in `src/lib/cfpb-data.ts` |
| `/dashboards/us-industry-gdp` | `src/app/dashboards/us-industry-gdp/page.tsx` | `getUsIndustryGdpReport()` in `src/lib/gdp-data.ts` |

**Publish a new dashboard** by: adding a `ReportMeta` entry to `reports` in
`src/lib/reports.ts` (drives its home-page card — title, subtitle, tags, hero
stat), adding a new `src/lib/<name>-data.ts` module that fetches and reshapes
its payload, and adding a `src/app/dashboards/<slug>/page.tsx` composed from
the block components below.

## Data layer (`src/lib/`)

| File | Role |
|---|---|
| `cfpb-data.ts` | Live fetch + reshape for the CFPB dashboard. `fetchPayload()` hits `CFPB_API_URL` (`cache: "no-store"`), `decodeRows()` turns the endpoint's columnar `{fields, data}` blocks into row objects, and `getCfpbReport()` (wrapped in React's `cache()` for per-request memoization) derives each dashboard section — including computing 7d/30d rolling averages and day/week-over-day deltas for `volumeDaily` client-side from the raw daily counts. |
| `gdp-data.ts` | Same pattern for the GDP dashboard: fetches `SQGDP_API_URL`, decodes columnar datasets (`national_gdp`, `state_gdp`, `industry_gdp`), filters each to its latest `period_date`, and ranks states/industries by GDP. |
| `reports.ts` | Static report registry consumed by the home page. Hero stats for the GDP entry are computed from `gdp-seed-data.ts` constants (not live data — the home-page card is a snapshot, not a live tile). |
| `gdp-seed-data.ts` | Randomly-generated fallback dataset from before `gdp-data.ts` fetched live data. Still imported for its exported **types** (`StateGdpRow`, `IndustryGdpRow`) and for the constants `reports.ts` uses on the home-page hero card — the generated rows themselves are otherwise unused now. |
| `cfpb-seed-data.ts` | Same-era fallback dataset for the CFPB dashboard. **Fully orphaned** — nothing imports it since `cfpb-data.ts` switched to live data. Safe to delete if you don't need it as a reference for the shape live data now fills. |
| `get-site-data.ts` | Orphaned — an earlier `API_BASE_URL`-based fetch helper (single `count`/`rows` shape) that predates the columnar `cfpb-data.ts`/`gdp-data.ts` pattern. Nothing imports it. |
| `utils.ts` | `cn()` (clsx + tailwind-merge) and `fmtNum()` (`Intl.NumberFormat`, used everywhere numbers are rendered). |

## Components

`src/components/blocks/` — report-specific primitives, each dashboard composes from these:

| Component | Purpose |
|---|---|
| `MetricCard` | Stat tile: label, value, optional unit/prefix, optional up/down change badge |
| `TrendChart` | Single-series gradient area chart (client component, Recharts) |
| `MultiTrendChart` | Multi-series line chart with a legend, optional dashed series (client component, Recharts) — used for the CFPB daily-volume-vs-rolling-average chart |
| `BarGraph` | Simple horizontal bar chart |
| `Heatmap` | Row × column intensity grid (used for the product × issue breakdown) |
| `UsStateMap` | Choropleth of the 50 states + DC using `d3-geo`/`topojson-client` against `us-atlas`'s TopoJSON, keyed by 2-digit state FIPS (client component) |
| `DataTable` | Generic typed table: `columns` (with optional per-column `format(value, row)` renderer) + `rows` |
| `PaginatedDataTable` | Wraps `DataTable` with server-rendered pagination — page state lives in the URL search params (`?<pageParam>=N`), so no client JS is needed for paging |
| `InsightCallout` | Highlighted methodology/explanation box (used throughout both dashboards to explain a stat's formula inline) |
| `ReportHeader` | Title + tags + date banner at the top of each dashboard |

`src/components/ui/` — shadcn-style low-level primitives: `Card`/`CardHeader`/`CardContent`, `Badge` (tone: `neutral`/`up`/`down`/`accent`), `TypewriterText` (home-page hero animation, respects `prefers-reduced-motion`).

## Theme

`src/app/globals.css` defines the palette as CSS custom properties
(`--background`, `--surface`, `--surface-2`, `--border`, `--foreground`,
`--muted`, `--signal` (green, "up"), `--danger` (red, "down"), `--accent`),
mapped into Tailwind v4 via `@theme inline`. Change the brand by editing the
`:root` block — every component using `bg-surface`, `text-signal`, etc.
picks it up automatically.

## Add real shadcn/ui components

```bash
npx shadcn@latest init      # then:
npx shadcn@latest add button dialog tabs
```

The included `Card`/`Badge` match shadcn conventions, so generated components drop in cleanly.
