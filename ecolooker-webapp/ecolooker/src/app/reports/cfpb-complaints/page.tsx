// src/app/reports/cfpb-complaints/page.tsx

import type { Metadata } from "next";

import { BarGraph } from "@/components/blocks/BarGraph";
import { DataTable } from "@/components/blocks/DataTable";
import { Heatmap } from "@/components/blocks/Heatmap";
import { InsightCallout } from "@/components/blocks/InsightCallout";
import { MetricCard } from "@/components/blocks/MetricCard";
import { MultiTrendChart } from "@/components/blocks/MultiTrendChart";
import { ReportHeader } from "@/components/blocks/ReportHeader";
import { Badge } from "@/components/ui/badge";
import { fmtNum } from "@/lib/utils";
import { getCfpbReport, seasonalityLabel } from "@/lib/cfpb-data";

export const metadata: Metadata = {
  title: "Consumer Financial Protection Bureau",
  description: "Complaint trends and anomaly detection dashboard.",
};

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatMonth(iso: string) {
  return new Date(`${iso}-01T00:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function hhiTone(hhi: number): { label: string; tone: "up" | "down" | "neutral" } {
  if (hhi >= 2500) return { label: "High concentration", tone: "down" };
  if (hhi >= 1500) return { label: "Moderate concentration", tone: "neutral" };
  return { label: "Low concentration", tone: "up" };
}

export default async function CfpbComplaintsPage() {
  const {
    generatedAt,
    volumeDaily,
    volumeAnomalies,
    seasonality,
    productMix,
    fastestGrowingIssues,
    productIssueHeatmap,
    issueConcentration,
    geoStateAnomalies,
  } = await getCfpbReport();

  const latest = volumeDaily.at(-1)!;

  const trendData = volumeDaily.map((d) => ({
    label: formatDay(d.dayReceived),
    complaints: d.complaints,
    avg7d: d.avg7d,
    avg30d: d.avg30d,
  }));

  const seasonalityChart = seasonality.map((s) => ({
    label: seasonalityLabel(s.dow),
    value: Math.round(s.avgComplaints),
  }));

  const topAnomaly = [...volumeAnomalies].sort((a, b) => b.zScore - a.zScore)[0];
  const topSpikeState = [...geoStateAnomalies]
    .filter((s) => s.isSpike)
    .sort((a, b) => b.zScore - a.zScore)[0];

  const heatmapCells = productIssueHeatmap.map((row) => ({
    row: row.product,
    column: row.issue,
    value: row.pctOfProduct,
    label: row.pctOfProduct.toFixed(1),
  }));

  return (
    <article className="space-y-12">
      <ReportHeader
        title="Consumer Financial Protection Bureau"
        subtitle="Daily complaint volume, seasonality, product mix shifts, and anomaly detection across CFPB consumer complaint data."
        date={formatMonth(latest.dayReceived.slice(0, 7))}
        tags={["Complaints", "Anomaly Detection", "Consumer Finance"]}
      />

      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted">
        Live data from the CFPB Complaint Analytics endpoint, generated{" "}
        {new Date(generatedAt).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        })}
        .
      </div>

      <section aria-labelledby="key-metrics-heading" className="space-y-4">
        <h2
          id="key-metrics-heading"
          className="text-sm uppercase tracking-wide text-muted"
        >
          Key metrics — {formatDay(latest.dayReceived)}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Complaints received"
            value={latest.complaints}
            change={latest.dodChange}
          />

          <MetricCard label="7-day average" value={latest.avg7d} />

          <MetricCard label="30-day average" value={latest.avg30d} />

          <MetricCard
            label="Week-over-week"
            value={latest.wowChange}
            change={latest.wowPctChange}
          />
        </div>
      </section>

      <MultiTrendChart
        title="Daily complaint volume vs. rolling averages"
        description="Complaints received per day against trailing 7-day and 30-day baselines."
        data={trendData}
        series={[
          { key: "complaints", label: "Daily complaints" },
          { key: "avg7d", label: "7-day avg" },
          { key: "avg30d", label: "30-day avg", dashed: true },
        ]}
      />

      <InsightCallout title="Primary signal">
        Daily complaint volume is running {latest.wowPctChange > 0 ? "up" : "down"}{" "}
        {fmtNum(Math.abs(latest.wowPctChange))}% week-over-week, with{" "}
        {latest.complaints.toLocaleString()} complaints received on{" "}
        {formatDay(latest.dayReceived)} against a 30-day baseline of{" "}
        {fmtNum(latest.avg30d)}.{" "}
        {topAnomaly && (
          <>
            The sharpest anomaly this period is {topAnomaly.product} —{" "}
            {topAnomaly.issue.toLowerCase()} — on{" "}
            {formatDay(topAnomaly.dayReceived)} (z-score{" "}
            {fmtNum(topAnomaly.zScore)}
            ){topSpikeState && ", and "}
          </>
        )}
        {topSpikeState && (
          <>
            {topSpikeState.state} shows the largest geographic spike at{" "}
            {fmtNum(topSpikeState.zScore)} standard deviations above baseline.
          </>
        )}
      </InsightCallout>

      <section aria-labelledby="anomalies-heading" className="space-y-4">
        <div>
          <h2
            id="anomalies-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Detected volume anomalies
          </h2>
          <p className="mt-2 text-sm text-muted">
            Product/issue-day combinations where complaint volume exceeded 3
            standard deviations above its trailing baseline.
          </p>
        </div>

        <DataTable
          title="Anomalous complaint spikes"
          columns={[
            { key: "dayReceived", label: "Day", format: (v) => formatDay(String(v)) },
            { key: "product", label: "Product" },
            { key: "issue", label: "Issue" },
            { key: "complaints", label: "Complaints", align: "right" },
            { key: "baselineAvg", label: "Baseline avg", align: "right" },
            {
              key: "zScore",
              label: "Z-score",
              align: "right",
              format: (v) => (
                <Badge tone="down">{fmtNum(Number(v))}σ</Badge>
              ),
            },
          ]}
          rows={volumeAnomalies.map((row) => ({
            dayReceived: row.dayReceived,
            product: row.product,
            issue: row.issue,
            complaints: row.complaints,
            baselineAvg: row.baselineAvg,
            zScore: row.zScore,
          }))}
        />
      </section>

      <section className="grid gap-8 lg:grid-cols-2">
        <BarGraph
          title="Average complaints by day of week"
          description={`Trailing seasonality for month ${seasonality[0]?.monthOfYear} (${seasonality[0]?.daysObserved} days observed).`}
          data={seasonalityChart}
        />

        <div className="space-y-4">
          <h2 className="text-lg font-semibold tracking-tight">
            State-level anomalies
          </h2>

          <DataTable
            title="Geographic complaint spikes"
            description={formatMonth(geoStateAnomalies[0]?.monthReceived ?? latest.dayReceived.slice(0, 7))}
            columns={[
              { key: "state", label: "State" },
              { key: "complaints", label: "Complaints", align: "right" },
              { key: "baselineAvg", label: "Baseline avg", align: "right" },
              {
                key: "zScore",
                label: "Z-score",
                align: "right",
                format: (v, row) => (
                  <Badge tone={row.isSpike ? "down" : "neutral"}>
                    {fmtNum(Number(v))}σ
                  </Badge>
                ),
              },
            ]}
            rows={geoStateAnomalies.map((row) => ({
              ...row,
              isSpike: row.isSpike ? 1 : 0,
            }))}
          />
        </div>
      </section>

      <section aria-labelledby="product-mix-heading" className="space-y-4">
        <div>
          <h2
            id="product-mix-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Complaints by product
          </h2>
          <p className="mt-2 text-sm text-muted">
            {formatMonth(productMix[0]?.monthReceived ?? latest.dayReceived.slice(0, 7))} volume,
            category share, and month-over-month share change.
          </p>
        </div>

        <DataTable
          title="Product mix"
          columns={[
            { key: "product", label: "Product" },
            { key: "subProduct", label: "Sub-product" },
            { key: "complaints", label: "Complaints", align: "right" },
            {
              key: "sharePct",
              label: "Share (%)",
              align: "right",
              format: (v) => `${fmtNum(Number(v))}%`,
            },
            {
              key: "sharePctChangeMom",
              label: "Δ share (pts, MoM)",
              align: "right",
              format: (v) => (
                <Badge tone={Number(v) >= 0 ? "up" : "down"}>
                  {Number(v) >= 0 ? "+" : ""}
                  {fmtNum(Number(v))}
                </Badge>
              ),
            },
          ]}
          rows={productMix}
        />
      </section>

      <section aria-labelledby="growth-heading" className="space-y-4">
        <div>
          <h2
            id="growth-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Fastest-growing issues
          </h2>
          <p className="mt-2 text-sm text-muted">
            Sub-issues with the largest month-over-month growth in complaint
            volume, ranked by growth rate.
          </p>
        </div>

        <DataTable
          title="Top movers"
          columns={[
            { key: "growthRank", label: "Rank", align: "center" },
            { key: "issue", label: "Issue" },
            { key: "subIssue", label: "Sub-issue" },
            { key: "complaints", label: "Complaints", align: "right" },
            { key: "prevComplaints", label: "Prior month", align: "right" },
            {
              key: "momGrowthPct",
              label: "MoM growth",
              align: "right",
              format: (v) => (
                <Badge tone="up">+{fmtNum(Number(v))}%</Badge>
              ),
            },
          ]}
          rows={fastestGrowingIssues}
        />
      </section>

      <section aria-labelledby="heatmap-heading" className="space-y-4">
        <div>
          <h2
            id="heatmap-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Product × issue breakdown
          </h2>
          <p className="mt-2 text-sm text-muted">
            Share of each product&apos;s complaints attributable to its
            leading issues this month.
          </p>
        </div>

        <Heatmap
          title="Issue share by product"
          description={formatMonth(productIssueHeatmap[0]?.monthReceived ?? latest.dayReceived.slice(0, 7))}
          data={heatmapCells}
        />
      </section>

      <section aria-labelledby="concentration-heading" className="space-y-4">
        <div>
          <h2
            id="concentration-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Issue concentration (HHI)
          </h2>
          <p className="mt-2 text-sm text-muted">
            Herfindahl-Hirschman Index of issue concentration within each
            product. Higher values indicate complaints are concentrated in
            fewer issue types.
          </p>
        </div>

        <DataTable
          title="Concentration by product"
          columns={[
            { key: "product", label: "Product" },
            { key: "hhi", label: "HHI", align: "right" },
            {
              key: "concentration",
              label: "Concentration",
              align: "right",
              format: (v) => {
                const { label, tone } = hhiTone(Number(v));
                return <Badge tone={tone}>{label}</Badge>;
              },
            },
          ]}
          rows={issueConcentration.map((row) => ({
            ...row,
            concentration: row.hhi,
          }))}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Methodology</h2>

        <p className="leading-7 text-muted">
          Volume metrics are computed on complaint receipt date, with 7-day
          and 30-day trailing averages used as the baseline for day-over-day
          and week-over-week comparisons. Anomalies are flagged when a
          product/issue/day combination exceeds a z-score of 3 relative to
          its trailing baseline; the same threshold is applied to
          state-level geographic volume.
        </p>

        <p className="leading-7 text-muted">
          Product mix and issue concentration are calculated monthly. The
          Herfindahl-Hirschman Index (HHI) sums the squared percentage share
          of each issue within a product; scores above 2,500 indicate high
          concentration, 1,500–2,500 moderate concentration, and below 1,500
          low concentration.
        </p>

        <p className="leading-7 text-muted">
          Figures on this page are sourced from the CFPB Complaint Analytics
          endpoint and should not be interpreted as measures of confirmed
          misconduct.
        </p>
      </section>
    </article>
  );
}
