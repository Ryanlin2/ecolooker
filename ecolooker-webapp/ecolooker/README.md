# Ecolooker

Environmental data-intelligence site — analysis reports, insights, and live dashboards
in a Robinhood-style dark theme. Next.js (App Router) + Tailwind v4 + shadcn-style
components + Recharts.

## Run
```bash
npm install
npm run dev      # http://localhost:3000
```

## How it's organized (the "universal reusable assets")
- `src/app/globals.css` — theme tokens (signal green, danger red, surfaces). Change the
  brand here; every block updates.
- `src/components/blocks/` — reusable report primitives:
  - `MetricCard`  — Robinhood stat tile with up/down badge
  - `TrendChart`  — gradient area chart (green=positive, red=negative)
  - `InsightCallout` — highlighted takeaway
  - `ReportHeader` — title + tags + date
  - `DataTable`   — tabular data
  - `LiveDashboard` — auto-refreshing metrics (swap the `seed()` fn for a real fetcher)
- `src/lib/reports.ts` — the report registry. **Publish a new report by adding one entry.**

## Publish a new report
1. Add a `ReportMeta` object to `reports` in `src/lib/reports.ts`.
2. It auto-appears on the home feed and gets a page at `/reports/<slug>`.
3. Compose the body in `src/app/reports/[slug]/page.tsx` from the blocks above.
   (For scale, migrate bodies to MDX or a CMS — the block components stay identical.)

## Live data
`LiveDashboard` polls every 4s with a mock `seed()`. Replace it with a real fetcher in
`src/lib/data.ts` (REST poll or WebSocket) returning the same `Snapshot` shape.

## Add real shadcn/ui components
```bash
npx shadcn@latest init      # then:
npx shadcn@latest add button dialog tabs
```
The included Card/Badge match shadcn conventions, so generated components drop in cleanly.
