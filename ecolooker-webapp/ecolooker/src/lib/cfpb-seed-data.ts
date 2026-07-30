/**
 * Seed data for the CFPB complaint trends & anomaly detection report.
 *
 * The live CFPB Complaint Analytics endpoint is currently unavailable, so
 * this module generates representative data that mirrors the production
 * response schema (volume, anomalies, seasonality, product mix, growth,
 * concentration, and geographic signals) for UI development and demos.
 */

export type VolumeDailyPoint = {
  dayReceived: string;
  complaints: number;
  avg7d: number;
  avg30d: number;
  dodChange: number;
  wowChange: number;
  wowPctChange: number;
};

function generateVolumeDaily(): VolumeDailyPoint[] {
  const start = new Date("2026-04-01T00:00:00Z");
  const totalDays = 106; // through 2026-07-15, with history for rolling averages

  let seed = 42;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const base: { date: Date; complaints: number }[] = [];

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(start);
    date.setUTCDate(date.getUTCDate() + i);

    const dow = date.getUTCDay();
    const weekendFactor = dow === 0 || dow === 6 ? 0.62 : 1;
    const trend = 950 + i * 2.6;
    const noise = (rand() - 0.5) * 140;
    const complaints = Math.max(300, Math.round((trend + noise) * weekendFactor));

    base.push({ date, complaints });
  }

  const rows: VolumeDailyPoint[] = base.map((day, i) => {
    const window7 = base.slice(Math.max(0, i - 6), i + 1);
    const window30 = base.slice(Math.max(0, i - 29), i + 1);

    const avg7d = window7.reduce((sum, d) => sum + d.complaints, 0) / window7.length;
    const avg30d = window30.reduce((sum, d) => sum + d.complaints, 0) / window30.length;

    const dodChange = i > 0 ? day.complaints - base[i - 1].complaints : 0;
    const wowChange = i >= 7 ? day.complaints - base[i - 7].complaints : 0;
    const wowPctChange =
      i >= 7 && base[i - 7].complaints !== 0
        ? (wowChange / base[i - 7].complaints) * 100
        : 0;

    return {
      dayReceived: day.date.toISOString().slice(0, 10),
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

export const volumeDaily = generateVolumeDaily();

export type VolumeAnomalyRow = {
  dayReceived: string;
  product: string;
  issue: string;
  complaints: number;
  baselineAvg: number;
  zScore: number;
  isAnomaly: boolean;
};

export const volumeAnomalies: VolumeAnomalyRow[] = [
  {
    dayReceived: "2026-07-15",
    product: "Credit reporting or other personal consumer reports",
    issue: "Incorrect information on your report",
    complaints: 184,
    baselineAvg: 96.43,
    zScore: 3.27,
    isAnomaly: true,
  },
  {
    dayReceived: "2026-07-12",
    product: "Debt collection",
    issue: "Attempts to collect debt not owed",
    complaints: 97,
    baselineAvg: 54.1,
    zScore: 2.88,
    isAnomaly: true,
  },
  {
    dayReceived: "2026-07-09",
    product: "Checking or savings account",
    issue: "Managing an account",
    complaints: 61,
    baselineAvg: 31.6,
    zScore: 3.41,
    isAnomaly: true,
  },
  {
    dayReceived: "2026-07-06",
    product: "Credit card",
    issue: "Problem with a purchase shown on your statement",
    complaints: 73,
    baselineAvg: 39.8,
    zScore: 3.02,
    isAnomaly: true,
  },
  {
    dayReceived: "2026-07-03",
    product: "Money transfer, virtual currency, or money service",
    issue: "Fraud or scam",
    complaints: 48,
    baselineAvg: 22.4,
    zScore: 3.55,
    isAnomaly: true,
  },
  {
    dayReceived: "2026-06-29",
    product: "Mortgage",
    issue: "Trouble during payment process",
    complaints: 39,
    baselineAvg: 19.9,
    zScore: 2.94,
    isAnomaly: true,
  },
];

export type SeasonalityRow = {
  dow: number;
  monthOfYear: number;
  avgComplaints: number;
  daysObserved: number;
};

const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const seasonality: SeasonalityRow[] = [
  { dow: 0, monthOfYear: 7, avgComplaints: 812.14, daysObserved: 18 },
  { dow: 1, monthOfYear: 7, avgComplaints: 1246.38, daysObserved: 18 },
  { dow: 2, monthOfYear: 7, avgComplaints: 1219.62, daysObserved: 18 },
  { dow: 3, monthOfYear: 7, avgComplaints: 1187.05, daysObserved: 18 },
  { dow: 4, monthOfYear: 7, avgComplaints: 1163.71, daysObserved: 18 },
  { dow: 5, monthOfYear: 7, avgComplaints: 1042.33, daysObserved: 18 },
  { dow: 6, monthOfYear: 7, avgComplaints: 779.86, daysObserved: 18 },
];

export function seasonalityLabel(dow: number) {
  return dowLabels[dow] ?? String(dow);
}

export type ProductMixRow = {
  monthReceived: string;
  product: string;
  subProduct: string;
  complaints: number;
  sharePct: number;
  sharePctChangeMom: number;
};

export const productMix: ProductMixRow[] = [
  {
    monthReceived: "2026-07",
    product: "Credit reporting",
    subProduct: "Credit reporting",
    complaints: 4821,
    sharePct: 38.27,
    sharePctChangeMom: 1.14,
  },
  {
    monthReceived: "2026-07",
    product: "Debt collection",
    subProduct: "Credit card debt",
    complaints: 2196,
    sharePct: 17.43,
    sharePctChangeMom: -0.62,
  },
  {
    monthReceived: "2026-07",
    product: "Credit card",
    subProduct: "General-purpose credit card",
    complaints: 1874,
    sharePct: 14.87,
    sharePctChangeMom: 0.48,
  },
  {
    monthReceived: "2026-07",
    product: "Checking or savings account",
    subProduct: "Checking account",
    complaints: 1122,
    sharePct: 8.91,
    sharePctChangeMom: 0.83,
  },
  {
    monthReceived: "2026-07",
    product: "Mortgage",
    subProduct: "Conventional home mortgage",
    complaints: 934,
    sharePct: 7.41,
    sharePctChangeMom: -0.29,
  },
  {
    monthReceived: "2026-07",
    product: "Money transfer, virtual currency, or money service",
    subProduct: "Domestic (US) money transfer",
    complaints: 611,
    sharePct: 4.85,
    sharePctChangeMom: 1.02,
  },
  {
    monthReceived: "2026-07",
    product: "Vehicle loan or lease",
    subProduct: "Loan",
    complaints: 486,
    sharePct: 3.86,
    sharePctChangeMom: 0.11,
  },
  {
    monthReceived: "2026-07",
    product: "Student loan",
    subProduct: "Federal student loan servicing",
    complaints: 397,
    sharePct: 3.15,
    sharePctChangeMom: -0.54,
  },
];

export type FastestGrowingIssueRow = {
  monthReceived: string;
  issue: string;
  subIssue: string;
  complaints: number;
  prevComplaints: number;
  momGrowthPct: number;
  growthRank: number;
};

export const fastestGrowingIssues: FastestGrowingIssueRow[] = [
  {
    monthReceived: "2026-07",
    issue: "Incorrect information on your report",
    subIssue: "Information belongs to someone else",
    complaints: 286,
    prevComplaints: 164,
    momGrowthPct: 74.4,
    growthRank: 1,
  },
  {
    monthReceived: "2026-07",
    issue: "Fraud or scam",
    subIssue: "Card was charged for something you did not purchase",
    complaints: 158,
    prevComplaints: 97,
    momGrowthPct: 62.9,
    growthRank: 2,
  },
  {
    monthReceived: "2026-07",
    issue: "Managing an account",
    subIssue: "Deposits and withdrawals",
    complaints: 121,
    prevComplaints: 81,
    momGrowthPct: 49.4,
    growthRank: 3,
  },
  {
    monthReceived: "2026-07",
    issue: "Attempts to collect debt not owed",
    subIssue: "Debt is not yours",
    complaints: 174,
    prevComplaints: 128,
    momGrowthPct: 35.9,
    growthRank: 4,
  },
  {
    monthReceived: "2026-07",
    issue: "Problem with a purchase shown on your statement",
    subIssue: "Credit card company isn't resolving a dispute",
    complaints: 96,
    prevComplaints: 73,
    momGrowthPct: 31.5,
    growthRank: 5,
  },
];

export type ProductIssueHeatmapRow = {
  monthReceived: string;
  product: string;
  issue: string;
  complaints: number;
  pctOfProduct: number;
};

export const productIssueHeatmap: ProductIssueHeatmapRow[] = [
  { monthReceived: "2026-07", product: "Credit reporting", issue: "Incorrect information on your report", complaints: 2847, pctOfProduct: 59.05 },
  { monthReceived: "2026-07", product: "Credit reporting", issue: "Improper use of your report", complaints: 891, pctOfProduct: 18.48 },
  { monthReceived: "2026-07", product: "Credit reporting", issue: "Problem with a company's investigation", complaints: 704, pctOfProduct: 14.6 },
  { monthReceived: "2026-07", product: "Credit reporting", issue: "Unable to get your credit report", complaints: 379, pctOfProduct: 7.86 },

  { monthReceived: "2026-07", product: "Debt collection", issue: "Attempts to collect debt not owed", complaints: 968, pctOfProduct: 44.08 },
  { monthReceived: "2026-07", product: "Debt collection", issue: "Written notification about debt", complaints: 512, pctOfProduct: 23.32 },
  { monthReceived: "2026-07", product: "Debt collection", issue: "Communication tactics", complaints: 401, pctOfProduct: 18.26 },
  { monthReceived: "2026-07", product: "Debt collection", issue: "False statements or representation", complaints: 315, pctOfProduct: 14.34 },

  { monthReceived: "2026-07", product: "Credit card", issue: "Problem with a purchase shown on your statement", complaints: 613, pctOfProduct: 32.71 },
  { monthReceived: "2026-07", product: "Credit card", issue: "Fees or interest", complaints: 487, pctOfProduct: 25.99 },
  { monthReceived: "2026-07", product: "Credit card", issue: "Getting a credit card", complaints: 402, pctOfProduct: 21.45 },
  { monthReceived: "2026-07", product: "Credit card", issue: "Closing your account", complaints: 372, pctOfProduct: 19.85 },

  { monthReceived: "2026-07", product: "Checking or savings account", issue: "Managing an account", complaints: 481, pctOfProduct: 42.87 },
  { monthReceived: "2026-07", product: "Checking or savings account", issue: "Problem caused by low funds", complaints: 289, pctOfProduct: 25.76 },
  { monthReceived: "2026-07", product: "Checking or savings account", issue: "Opening an account", complaints: 218, pctOfProduct: 19.43 },
  { monthReceived: "2026-07", product: "Checking or savings account", issue: "Closing an account", complaints: 134, pctOfProduct: 11.94 },
];

export type IssueConcentrationRow = {
  monthReceived: string;
  product: string;
  hhi: number;
};

export const issueConcentration: IssueConcentrationRow[] = [
  { monthReceived: "2026-07", product: "Credit reporting", hhi: 4218 },
  { monthReceived: "2026-07", product: "Debt collection", hhi: 2896 },
  { monthReceived: "2026-07", product: "Credit card", hhi: 2318 },
  { monthReceived: "2026-07", product: "Checking or savings account", hhi: 2764 },
  { monthReceived: "2026-07", product: "Mortgage", hhi: 1932 },
  { monthReceived: "2026-07", product: "Money transfer, virtual currency, or money service", hhi: 2451 },
  { monthReceived: "2026-07", product: "Vehicle loan or lease", hhi: 1687 },
  { monthReceived: "2026-07", product: "Student loan", hhi: 3104 },
];

export type GeoStateAnomalyRow = {
  monthReceived: string;
  state: string;
  complaints: number;
  baselineAvg: number;
  zScore: number;
  isSpike: boolean;
};

export const geoStateAnomalies: GeoStateAnomalyRow[] = [
  { monthReceived: "2026-07", state: "CA", complaints: 4821, baselineAvg: 3514.7, zScore: 3.24, isSpike: true },
  { monthReceived: "2026-07", state: "TX", complaints: 3106, baselineAvg: 2698.2, zScore: 1.87, isSpike: false },
  { monthReceived: "2026-07", state: "FL", complaints: 2984, baselineAvg: 2211.6, zScore: 2.91, isSpike: true },
  { monthReceived: "2026-07", state: "NY", complaints: 2417, baselineAvg: 2288.4, zScore: 0.62, isSpike: false },
  { monthReceived: "2026-07", state: "GA", complaints: 1652, baselineAvg: 1104.9, zScore: 3.08, isSpike: true },
  { monthReceived: "2026-07", state: "IL", complaints: 1398, baselineAvg: 1276.5, zScore: 0.94, isSpike: false },
  { monthReceived: "2026-07", state: "PA", complaints: 1211, baselineAvg: 1163.8, zScore: 0.41, isSpike: false },
  { monthReceived: "2026-07", state: "NV", complaints: 742, baselineAvg: 481.3, zScore: 2.76, isSpike: true },
  { monthReceived: "2026-07", state: "AZ", complaints: 968, baselineAvg: 861.1, zScore: 1.12, isSpike: false },
  { monthReceived: "2026-07", state: "OH", complaints: 887, baselineAvg: 842.9, zScore: 0.35, isSpike: false },
];
