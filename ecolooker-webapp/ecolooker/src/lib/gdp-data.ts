import "server-only";
import { cache } from "react";

import type { StateGdpRow, IndustryGdpRow } from "./gdp-seed-data";

export type { StateGdpRow, IndustryGdpRow };

/**
 * Live data access for the US industry GDP dashboard.
 *
 * Fetches the columnar analytics payload from the SQGDP main-metrics reader
 * Lambda endpoint (bea/lambda/sqgdp_main_metrics_reader.py, serving the gold
 * object written by bea/lambda/sqgdp_main_metrics.py) and reshapes it into
 * the row-oriented types the dashboard page renders. See cfpb-data.ts for
 * the live-fetch pattern this follows.
 *
 * gdp-seed-data.ts is kept as a fallback/demo dataset even though nothing
 * imports it now that this reads live data -- see cfpb-seed-data.ts for the
 * same convention.
 */

type ColumnarDataset = {
  order: string;
  row_count: number;
  fields: string[];
  data: unknown[][];
};

type SqgdpPayload = {
  schema_version: string;
  generated_at: string;
  timezone: string;
  encoding: string;
  datasets: Record<string, ColumnarDataset>;
};

function decodeRows<T extends Record<string, unknown>>(
  dataset: ColumnarDataset | undefined
): T[] {
  if (!dataset) return [];

  return dataset.data.map((row) => {
    const obj: Record<string, unknown> = {};
    dataset.fields.forEach((field, i) => {
      obj[field] = row[i];
    });
    return obj as T;
  });
}

async function fetchPayload(): Promise<SqgdpPayload> {
  const endpoint = process.env.SQGDP_API_URL;

  if (!endpoint) {
    throw new Error("Missing SQGDP_API_URL");
  }

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch SQGDP data: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as SqgdpPayload;
}

export type UsIndustryGdpReport = {
  generatedAt: string;
  quarter: string;
  nationalGdpMillions: number;
  nationalQoqPctChange: number;
  nationalYoyPctChange: number;
  states: StateGdpRow[];
  industries: IndustryGdpRow[];
};

function latestPeriod(rows: { period_date: string }[]): string {
  return rows.reduce(
    (max, r) => (r.period_date > max ? r.period_date : max),
    ""
  );
}

export const getUsIndustryGdpReport = cache(
  async (): Promise<UsIndustryGdpReport> => {
    const payload = await fetchPayload();
    const { datasets } = payload;

    const nationalRows = decodeRows<{
      period_date: string;
      year: number;
      quarter: number;
      gdp_millions: number;
      qoq_pct_change: number | null;
      yoy_pct_change: number | null;
    }>(datasets.national_gdp);

    const latestNational = nationalRows.find(
      (r) => r.period_date === latestPeriod(nationalRows)
    );

    if (!latestNational) {
      throw new Error("SQGDP national_gdp dataset returned no rows");
    }

    const stateRows = decodeRows<{
      state_fips: string;
      state_code: string | null;
      state_name: string;
      period_date: string;
      gdp_millions: number;
      qoq_pct_change: number | null;
      yoy_pct_change: number | null;
      leading_industry: string | null;
    }>(datasets.state_gdp);
    const latestStatePeriod = latestPeriod(stateRows);

    const states = stateRows
      .filter((r) => r.period_date === latestStatePeriod && r.state_fips !== "00")
      .sort((a, b) => b.gdp_millions - a.gdp_millions)
      .map((r) => ({
        stateFips: r.state_fips,
        state: r.state_code ?? "",
        stateName: r.state_name,
        gdpMillions: r.gdp_millions,
        qoqPctChange: r.qoq_pct_change ?? 0,
        yoyPctChange: r.yoy_pct_change ?? 0,
        leadingIndustry: r.leading_industry ?? "",
      }));

    const industryRows = decodeRows<{
      industry: string;
      period_date: string;
      gdp_millions: number;
      share_pct: number;
      qoq_pct_change: number | null;
      yoy_pct_change: number | null;
    }>(datasets.industry_gdp);
    const latestIndustryPeriod = latestPeriod(industryRows);

    const industries = industryRows
      .filter((r) => r.period_date === latestIndustryPeriod)
      .sort((a, b) => b.gdp_millions - a.gdp_millions)
      .map((r) => ({
        industry: r.industry,
        gdpMillions: r.gdp_millions,
        sharePct: r.share_pct,
        qoqPctChange: r.qoq_pct_change ?? 0,
        yoyPctChange: r.yoy_pct_change ?? 0,
      }));

    return {
      generatedAt: payload.generated_at,
      quarter: `${latestNational.year} Q${latestNational.quarter}`,
      nationalGdpMillions: latestNational.gdp_millions,
      nationalQoqPctChange: latestNational.qoq_pct_change ?? 0,
      nationalYoyPctChange: latestNational.yoy_pct_change ?? 0,
      states,
      industries,
    };
  }
);
