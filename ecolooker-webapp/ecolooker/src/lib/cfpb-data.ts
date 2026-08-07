import "server-only";
import { cache } from "react";

/**
 * Live data access for the CFPB complaint trends & anomaly detection report.
 *
 * Fetches the columnar analytics payload from the CFPB Complaint Analytics
 * Lambda endpoint and reshapes each dataset into the row-oriented types the
 * report page renders.
 */

type ColumnarDataset = {
  order: string;
  row_count: number;
  fields: string[];
  data: unknown[][];
};

type CfpbPayload = {
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

async function fetchPayload(): Promise<CfpbPayload> {
  const endpoint = process.env.CFPB_API_URL;

  if (!endpoint) {
    throw new Error("Missing CFPB_API_URL");
  }

  const response = await fetch(endpoint, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch CFPB data: ${response.status} ${response.statusText}`
    );
  }

  return (await response.json()) as CfpbPayload;
}

export type VolumeDailyPoint = {
  dayReceived: string;
  complaints: number;
  avg7d: number;
  avg30d: number;
  dodChange: number;
  wowChange: number;
  wowPctChange: number;
};

export type VolumeAnomalyRow = {
  dayReceived: string;
  product: string;
  issue: string;
  complaints: number;
  baselineAvg: number;
  zScore: number;
  isAnomaly: boolean;
};

export type SeasonalityRow = {
  dow: number;
  monthOfYear: number;
  avgComplaints: number;
  daysObserved: number;
};

export type ProductMixRow = {
  monthReceived: string;
  product: string;
  subProduct: string;
  complaints: number;
  sharePct: number;
  sharePctChangeMom: number;
};

export type FastestGrowingIssueRow = {
  monthReceived: string;
  issue: string;
  subIssue: string;
  complaints: number;
  prevComplaints: number;
  momGrowthPct: number;
  growthRank: number;
};

export type ProductIssueHeatmapRow = {
  monthReceived: string;
  product: string;
  issue: string;
  complaints: number;
  pctOfProduct: number;
};

export type IssueConcentrationRow = {
  monthReceived: string;
  product: string;
  hhi: number;
};

export type GeoStateAnomalyRow = {
  monthReceived: string;
  state: string;
  complaints: number;
  baselineAvg: number;
  zScore: number;
  isSpike: boolean;
};

export type CfpbReport = {
  generatedAt: string;
  volumeDaily: VolumeDailyPoint[];
  volumeAnomalies: VolumeAnomalyRow[];
  seasonality: SeasonalityRow[];
  seasonalityMonth: number;
  productMix: ProductMixRow[];
  fastestGrowingIssues: FastestGrowingIssueRow[];
  productIssueHeatmap: ProductIssueHeatmapRow[];
  issueConcentration: IssueConcentrationRow[];
  geoStateAnomalies: GeoStateAnomalyRow[];
};

const dowLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function seasonalityLabel(dow: number) {
  return dowLabels[dow - 1] ?? String(dow);
}

function latestMonth(rows: { month_received: string }[]): string {
  return rows.reduce(
    (max, r) => (r.month_received > max ? r.month_received : max),
    ""
  );
}

function computeVolumeDaily(
  raw: { day_received: string; complaints: number }[]
): VolumeDailyPoint[] {
  const sorted = [...raw].sort((a, b) =>
    a.day_received.localeCompare(b.day_received)
  );

  const rows: VolumeDailyPoint[] = sorted.map((day, i) => {
    const window7 = sorted.slice(Math.max(0, i - 6), i + 1);
    const window30 = sorted.slice(Math.max(0, i - 29), i + 1);

    const avg7d =
      window7.reduce((sum, d) => sum + d.complaints, 0) / window7.length;
    const avg30d =
      window30.reduce((sum, d) => sum + d.complaints, 0) / window30.length;

    const dodChange = i > 0 ? day.complaints - sorted[i - 1].complaints : 0;
    const wowChange =
      i >= 7 ? day.complaints - sorted[i - 7].complaints : 0;
    const wowPctChange =
      i >= 7 && sorted[i - 7].complaints !== 0
        ? (wowChange / sorted[i - 7].complaints) * 100
        : 0;

    return {
      dayReceived: day.day_received,
      complaints: day.complaints,
      avg7d: Math.round(avg7d * 100) / 100,
      avg30d: Math.round(avg30d * 100) / 100,
      dodChange,
      wowChange,
      wowPctChange: Math.round(wowPctChange * 10) / 10,
    };
  });

  return rows.slice(-30);
}

export const getCfpbReport = cache(async (): Promise<CfpbReport> => {
  const payload = await fetchPayload();
  const { datasets } = payload;

  const volumeDaily = computeVolumeDaily(
    decodeRows<{ day_received: string; complaints: number }>(
      datasets.volume_daily
    )
  );

  const volumeAnomalies = decodeRows<{
    day_received: string;
    product: string;
    issue: string;
    complaints: number;
    baseline_avg: number | null;
    z_score: number | null;
    is_anomaly: boolean | null;
  }>(datasets.volume_anomaly_product_issue)
    .filter((r) => r.is_anomaly === true)
    .sort((a, b) => b.day_received.localeCompare(a.day_received))
    .slice(0, 8)
    .map((r) => ({
      dayReceived: r.day_received,
      product: r.product,
      issue: r.issue,
      complaints: r.complaints,
      baselineAvg: r.baseline_avg ?? 0,
      zScore: r.z_score ?? 0,
      isAnomaly: true,
    }));

  const latestVolumeDay = volumeDaily.at(-1)?.dayReceived;
  const seasonalityMonth = latestVolumeDay
    ? Number(latestVolumeDay.slice(5, 7))
    : new Date().getUTCMonth() + 1;

  const seasonality = decodeRows<{
    dow: number;
    month_of_year: number;
    avg_complaints: number;
    days_observed: number;
  }>(datasets.volume_seasonality)
    .filter((r) => r.month_of_year === seasonalityMonth)
    .sort((a, b) => a.dow - b.dow)
    .map((r) => ({
      dow: r.dow,
      monthOfYear: r.month_of_year,
      avgComplaints: r.avg_complaints,
      daysObserved: r.days_observed,
    }));

  const productMixRaw = decodeRows<{
    month_received: string;
    product: string;
    sub_product: string;
    complaints: number;
    share_pct: number;
    share_pct_change_mom: number | null;
  }>(datasets.mix_product_monthly);
  const productMixMonth = latestMonth(productMixRaw);
  const productMix = productMixRaw
    .filter((r) => r.month_received === productMixMonth)
    .sort((a, b) => b.complaints - a.complaints)
    .slice(0, 8)
    .map((r) => ({
      monthReceived: r.month_received,
      product: r.product,
      subProduct: r.sub_product,
      complaints: r.complaints,
      sharePct: r.share_pct,
      sharePctChangeMom: r.share_pct_change_mom ?? 0,
    }));

  const fastestGrowingRaw = decodeRows<{
    month_received: string;
    issue: string;
    sub_issue: string;
    complaints_to_date: number;
    prev_complaints: number;
    growth_vs_expected_pct: number;
    growth_rank: number;
  }>(datasets.fastest_growing_issues);
  const fastestGrowingMonth = latestMonth(fastestGrowingRaw);
  const fastestGrowingIssues = fastestGrowingRaw
    .filter((r) => r.month_received === fastestGrowingMonth)
    .sort((a, b) => a.growth_rank - b.growth_rank)
    .slice(0, 5)
    .map((r) => ({
      monthReceived: r.month_received,
      issue: r.issue,
      subIssue: r.sub_issue,
      complaints: r.complaints_to_date,
      prevComplaints: r.prev_complaints,
      momGrowthPct: r.growth_vs_expected_pct,
      growthRank: r.growth_rank,
    }));

  const heatmapRaw = decodeRows<{
    month_received: string;
    product: string;
    issue: string;
    complaints: number;
    pct_of_product: number;
  }>(datasets.product_issue_heatmap);
  const heatmapMonth = latestMonth(heatmapRaw);
  const productIssueHeatmap = heatmapRaw
    .filter((r) => r.month_received === heatmapMonth)
    .map((r) => ({
      monthReceived: r.month_received,
      product: r.product,
      issue: r.issue,
      complaints: r.complaints,
      pctOfProduct: r.pct_of_product,
    }));

  const hhiRaw = decodeRows<{
    month_received: string;
    product: string;
    hhi: number;
  }>(datasets.issue_concentration_hhi);
  const hhiMonth = latestMonth(hhiRaw);
  const issueConcentration = hhiRaw
    .filter((r) => r.month_received === hhiMonth)
    .sort((a, b) => b.hhi - a.hhi)
    .map((r) => ({
      monthReceived: r.month_received,
      product: r.product,
      hhi: r.hhi,
    }));

  const geoRaw = decodeRows<{
    month_received: string;
    state: string;
    complaints: number;
    baseline_avg: number | null;
    z_score: number | null;
    is_spike: boolean | null;
  }>(datasets.geo_state_anomaly);
  const geoMonth = latestMonth(geoRaw);
  const geoStateAnomalies = geoRaw
    .filter((r) => r.month_received === geoMonth)
    .sort((a, b) => b.complaints - a.complaints)
    .slice(0, 10)
    .map((r) => ({
      monthReceived: r.month_received,
      state: r.state,
      complaints: r.complaints,
      baselineAvg: r.baseline_avg ?? 0,
      zScore: r.z_score ?? 0,
      isSpike: r.is_spike === true,
    }));

  return {
    generatedAt: payload.generated_at,
    volumeDaily,
    volumeAnomalies,
    seasonality,
    seasonalityMonth,
    productMix,
    fastestGrowingIssues,
    productIssueHeatmap,
    issueConcentration,
    geoStateAnomalies,
  };
});
