// src/app/reports/cfpb-complaints/page.tsx

import type { Metadata } from "next";

import { DataTable } from "@/components/blocks/DataTable";
import { PaginatedDataTable } from "@/components/blocks/PaginatedDataTable";
import { Heatmap } from "@/components/blocks/Heatmap";
import { MetricCard } from "@/components/blocks/MetricCard";
import { InsightCallout } from "@/components/blocks/InsightCallout";
import { MultiTrendChart } from "@/components/blocks/MultiTrendChart";
import { ReportHeader } from "@/components/blocks/ReportHeader";
import { Badge } from "@/components/ui/badge";
import { fmtNum } from "@/lib/utils";
import { getCfpbReport } from "@/lib/cfpb-data";

export const metadata: Metadata = {
  title: "Consumer Financial Protection Bureau Anomaly Dashboard",
  description: "Complaint trends and anomaly detection dashboard.",
};

export const dynamic = "force-dynamic";

function formatDay(iso: string) {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function formatMonth(iso: string) {
  const yearMonth = iso.slice(0, 7);
  return new Date(`${yearMonth}-01T00:00:00Z`).toLocaleDateString("en-US", {
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

export default async function CfpbComplaintsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const {
    generatedAt,
    volumeDaily,
    volumeAnomalies,
    productMix,
    fastestGrowingIssues,
    productIssueHeatmap,
    issueConcentration,
    geoStateAnomalies,
  } = await getCfpbReport();

  const resolvedSearchParams = await searchParams;
  const geoPage = Number(resolvedSearchParams.page) || 1;
  const anomalyPage = Number(resolvedSearchParams.anomalyPage) || 1;

  const latest = volumeDaily.at(-1)!;

  const trendData = volumeDaily.map((d) => ({
    label: formatDay(d.dayReceived),
    complaints: d.complaints,
    avg7d: d.avg7d,
    avg30d: d.avg30d,
  }));

  const heatmapCells = productIssueHeatmap.map((row) => ({
    row: row.product,
    column: row.issue,
    value: row.pctOfProduct,
    label: row.pctOfProduct.toFixed(1),
  }));

  return (
    <article className="space-y-12">
      <ReportHeader
        title="Consumer Financial Protection Bureau Anomaly Dashboard"
        subtitle="Daily complaint volume, product mix shifts, and anomaly detection across CFPB consumer complaint data."
        date={formatMonth(latest.dayReceived.slice(0, 7))}
        tags={["Complaints", "Anomaly Detection", "Consumer Finance"]}
      />

      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted">
        Live data from the CFPB Complaint Analytics endpoint, generated{" "}
        {new Date(generatedAt).toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "America/New_York",
        })}{" "}
        ET.
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
            changeIsPercent={false}
          />

          <MetricCard label="7-day average" value={latest.avg7d} />

          <MetricCard label="30-day average" value={latest.avg30d} />

          <MetricCard
            label="Week-over-week"
            value={latest.wowChange}
            change={latest.wowPctChange}
          />
        </div>

        <p className="text-xs text-muted">
          Note: datasets are not live — CFPB complaint data may take up to
          15 days to be posted.
        </p>
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

      <section aria-labelledby="anomalies-heading" className="grid gap-8 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <h2
              id="anomalies-heading"
              className="text-lg font-semibold tracking-tight"
            >
              Anomaly detection
            </h2>
            <p className="mt-2 text-sm text-muted">
              Product/issue-day combinations with confirmed complaint spikes
              year to date &mdash; at least 3 standard deviations above their
              own trailing 28-day baseline.
            </p>
          </div>

          <PaginatedDataTable
            title="Anomalous complaint spikes"
            description={`Year to date, ${new Date().getUTCFullYear()}`}
            page={anomalyPage}
            pageSize={10}
            pageParam="anomalyPage"
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
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              State-level anomalies
            </h2>
            <p className="mt-2 text-sm text-muted">
              States with confirmed complaint spikes year to date &mdash;
              at least 3 standard deviations above their own trailing
              180-day baseline.
            </p>
          </div>

          <InsightCallout title="How expected complaints is calculated">
            <span className="block">
              For each state and day, the state&apos;s own trailing 180-day
              (~6 month) daily complaint history is used to establish what a
              normal day looks like:
            </span>
            <code className="mt-2 block overflow-x-auto rounded-lg border bg-surface-2 px-3 py-2 font-mono text-xs text-foreground/90">
              expected complaints = AVG(complaints) over trailing 180 days
              <br />
              z-score = (complaints − expected complaints) ÷ STDDEV(trailing
              180 days)
            </code>
            <span className="mt-2 block">
              A day is flagged as a spike when its z-score is at least 3
              and it has at least 10 complaints, so low-volume states
              don&apos;t register large swings from a handful of
              complaints.
            </span>
          </InsightCallout>

          <PaginatedDataTable
            title="Geographic complaint spikes"
            description={`Year to date, ${new Date().getUTCFullYear()}`}
            page={geoPage}
            pageSize={10}
            columns={[
              {
                key: "dayReceived",
                label: "Day",
                format: (v) => formatDay(String(v)),
              },
              { key: "state", label: "State" },
              { key: "complaints", label: "Complaints", align: "right" },
              { key: "expectedComplaints", label: "Expected", align: "right" },
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
            Sub-issues running hottest relative to their own expected pace,
            ranked by growth rate.
          </p>
        </div>

        <InsightCallout title="How growth vs. expected is calculated">
          <span className="block">
            For each issue / sub-issue, the prior month&apos;s daily complaint
            rate is projected forward across the elapsed days of the current
            month to get an expected count, then compared to what actually
            came in:
          </span>
          <code className="mt-2 block overflow-x-auto rounded-lg border bg-surface-2 px-3 py-2 font-mono text-xs text-foreground/90">
            expected = prior month avg daily complaints × days elapsed this
            month
            <br />
            growth % = ((complaints − expected) ÷ expected) × 100
          </code>
          <span className="mt-2 block">
            Rank is assigned within each month by that growth rate, highest
            first. Only issue / sub-issue pairs with at least 10 complaints
            in the prior month are included, to avoid small-sample spikes
            (e.g. 1 → 3 complaints reading as +200%) crowding out real
            movers.
          </span>
        </InsightCallout>

        <DataTable
          title="Top movers"
          columns={[
            { key: "growthRank", label: "Rank", align: "center" },
            { key: "issue", label: "Issue" },
            { key: "subIssue", label: "Sub-issue" },
            { key: "complaints", label: "Complaints (to date)", align: "right" },
            { key: "expectedComplaints", label: "Expected (to date)", align: "right" },
            {
              key: "momGrowthPct",
              label: "Growth vs. expected",
              align: "right",
              format: (v) => (
                <Badge tone={Number(v) >= 0 ? "up" : "down"}>
                  {Number(v) >= 0 ? "+" : ""}
                  {fmtNum(Number(v))}%
                </Badge>
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
          and week-over-week comparisons. Product/issue-day anomalies are
          flagged when a combination exceeds a z-score of 3 (either
          direction) relative to its own trailing 28-day baseline. The
          anomaly detection table above shows only flagged spikes year to
          date, filtered server-side before the report is generated and
          paginated here.
        </p>

        <p className="leading-7 text-muted">
          State-level anomalies compare each state&apos;s daily complaint
          count to that state&apos;s own trailing 180-day (~6 month) daily
          history:{" "}
          <span className="font-mono text-xs">expected complaints = AVG(complaints) over trailing 180 days</span>,{" "}
          <span className="font-mono text-xs">z-score = (complaints − expected complaints) ÷ STDDEV(trailing 180 days)</span>.
          A day is flagged as a spike when it exceeds a z-score of 3 and has
          at least 10 complaints, to avoid low-volume states registering
          large swings from a handful of complaints. The table above shows
          only flagged spikes year to date, filtered server-side before the
          report is generated and paginated here.
        </p>

        <p className="leading-7 text-muted">
          Fastest-growing issues compares each issue / sub-issue&apos;s
          complaint count so far this month to an expected count projected
          from the prior month&apos;s daily rate:{" "}
          <span className="font-mono text-xs">growth % = ((complaints − expected) ÷ expected) × 100</span>,
          where <span className="font-mono text-xs">expected = prior month avg daily complaints × days elapsed this month</span>.
          Pairs are ranked within each month by that growth rate, and pairs
          with fewer than 10 complaints in the prior month are excluded so
          low-volume noise doesn&apos;t dominate the rankings.
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
