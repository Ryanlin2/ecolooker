// src/app/dashboards/us-industry-gdp/page.tsx

import type { Metadata } from "next";

import { PaginatedDataTable } from "@/components/blocks/PaginatedDataTable";
import { DataTable } from "@/components/blocks/DataTable";
import { MetricCard } from "@/components/blocks/MetricCard";
import { InsightCallout } from "@/components/blocks/InsightCallout";
import { UsStateMap } from "@/components/blocks/UsStateMap";
import { ReportHeader } from "@/components/blocks/ReportHeader";
import { Badge } from "@/components/ui/badge";
import { fmtNum } from "@/lib/utils";
import { getUsIndustryGdpReport } from "@/lib/gdp-data";

export const metadata: Metadata = {
  title: "United States Industry GDP Dashboard",
  description: "State-level real GDP and industry composition across the US economy.",
};

export const dynamic = "force-dynamic";

function billions(millions: number) {
  return millions / 1000;
}

function pctBadge(value: number) {
  return (
    <Badge tone={value >= 0 ? "up" : "down"}>
      {value >= 0 ? "+" : ""}
      {fmtNum(value)}%
    </Badge>
  );
}

export default async function UsIndustryGdpPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const {
    generatedAt,
    quarter,
    nationalGdpMillions,
    nationalQoqPctChange,
    nationalYoyPctChange,
    states,
    industries,
  } = await getUsIndustryGdpReport();

  const resolvedSearchParams = await searchParams;
  const statePage = Number(resolvedSearchParams.statePage) || 1;

  const topIndustry = industries[0];

  const mapData = states.map((s) => ({
    id: s.stateFips,
    value: s.gdpMillions,
    label: `$${fmtNum(billions(s.gdpMillions))}B`,
  }));

  const fastestGrowing = [...states]
    .sort((a, b) => b.qoqPctChange - a.qoqPctChange)
    .slice(0, 5);

  return (
    <article className="space-y-12">
      <ReportHeader
        title="United States Industry GDP Dashboard"
        subtitle="Real GDP by state and by industry, with quarter-over-quarter and year-over-year growth."
        date={quarter}
        tags={["GDP", "Industry", "Macroeconomics"]}
      />

      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted">
        Live data from the BEA SQGDP main-metrics endpoint, generated{" "}
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
          Key metrics — {quarter}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="National real GDP"
            value={billions(nationalGdpMillions)}
            unit="$B"
          />

          <MetricCard
            label="Quarter-over-quarter"
            value={nationalQoqPctChange}
            unit="%"
          />

          <MetricCard
            label="Year-over-year"
            value={nationalYoyPctChange}
            unit="%"
          />

          <MetricCard
            label={`Leading industry (${fmtNum(topIndustry.sharePct)}% share)`}
            value={billions(topIndustry.gdpMillions)}
            unit="$B"
          />
        </div>
      </section>

      <UsStateMap
        title="Real GDP by state"
        description={`${quarter}, chained dollars`}
        data={mapData}
      />

      <section aria-labelledby="state-ranking-heading" className="space-y-4">
        <div>
          <h2
            id="state-ranking-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            State GDP ranking
          </h2>
          <p className="mt-2 text-sm text-muted">
            All 50 states plus DC, ranked by real GDP, with each state&apos;s
            leading industry by output.
          </p>
        </div>

        <PaginatedDataTable
          title="State GDP"
          description={quarter}
          page={statePage}
          pageSize={15}
          pageParam="statePage"
          columns={[
            { key: "stateRank", label: "Rank", align: "center" },
            { key: "stateName", label: "State" },
            { key: "state", label: "Code", align: "center" },
            {
              key: "gdpBillions",
              label: "Real GDP ($B)",
              align: "right",
              format: (v) => fmtNum(Number(v)),
            },
            {
              key: "qoqPctChange",
              label: "QoQ",
              align: "right",
              format: (v) => pctBadge(Number(v)),
            },
            {
              key: "yoyPctChange",
              label: "YoY",
              align: "right",
              format: (v) => pctBadge(Number(v)),
            },
            { key: "leadingIndustry", label: "Leading industry" },
          ]}
          rows={states.map((s, i) => ({
            stateRank: i + 1,
            stateName: s.stateName,
            state: s.state,
            gdpBillions: billions(s.gdpMillions),
            qoqPctChange: s.qoqPctChange,
            yoyPctChange: s.yoyPctChange,
            leadingIndustry: s.leadingIndustry,
          }))}
        />
      </section>

      <section aria-labelledby="growth-heading" className="space-y-4">
        <div>
          <h2
            id="growth-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Fastest-growing state economies
          </h2>
          <p className="mt-2 text-sm text-muted">
            States with the strongest quarter-over-quarter real GDP growth.
          </p>
        </div>

        <DataTable
          title="Top movers"
          columns={[
            { key: "stateName", label: "State" },
            {
              key: "gdpBillions",
              label: "Real GDP ($B)",
              align: "right",
              format: (v) => fmtNum(Number(v)),
            },
            {
              key: "qoqPctChange",
              label: "QoQ growth",
              align: "right",
              format: (v) => pctBadge(Number(v)),
            },
            { key: "leadingIndustry", label: "Leading industry" },
          ]}
          rows={fastestGrowing.map((s) => ({
            stateName: s.stateName,
            gdpBillions: billions(s.gdpMillions),
            qoqPctChange: s.qoqPctChange,
            leadingIndustry: s.leadingIndustry,
          }))}
        />
      </section>

      <section aria-labelledby="industry-heading" className="space-y-4">
        <div>
          <h2
            id="industry-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            GDP by industry
          </h2>
          <p className="mt-2 text-sm text-muted">
            National output share and growth for each industry supersector.
          </p>
        </div>

        <InsightCallout title="How growth is calculated">
          <span className="block">
            Quarter-over-quarter (QoQ) growth compares each industry&apos;s
            (or state&apos;s) real GDP to the prior quarter; year-over-year
            (YoY) compares it to the same quarter one year prior. National
            totals are BEA&apos;s own published U.S. total for each measure,
            not a sum or average of the state figures.
          </span>
        </InsightCallout>

        <DataTable
          title="Industry mix"
          description={quarter}
          columns={[
            { key: "industry", label: "Industry" },
            {
              key: "gdpBillions",
              label: "Real GDP ($B)",
              align: "right",
              format: (v) => fmtNum(Number(v)),
            },
            {
              key: "sharePct",
              label: "Share (%)",
              align: "right",
              format: (v) => `${fmtNum(Number(v))}%`,
            },
            {
              key: "qoqPctChange",
              label: "QoQ",
              align: "right",
              format: (v) => pctBadge(Number(v)),
            },
            {
              key: "yoyPctChange",
              label: "YoY",
              align: "right",
              format: (v) => pctBadge(Number(v)),
            },
          ]}
          rows={industries.map((ind) => ({
            industry: ind.industry,
            gdpBillions: billions(ind.gdpMillions),
            sharePct: ind.sharePct,
            qoqPctChange: ind.qoqPctChange,
            yoyPctChange: ind.yoyPctChange,
          }))}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Methodology</h2>

        <p className="leading-7 text-muted">
          Real GDP by state is expressed in chained dollars and reflects
          total economic output attributable to each state for the given
          quarter. The state map and ranking table order states from highest
          to lowest output; the &ldquo;leading industry&rdquo; column shows
          each state&apos;s largest contributing industry supersector by
          output.
        </p>

        <p className="leading-7 text-muted">
          Industry mix is computed nationally as each supersector&apos;s
          share of total real GDP for the quarter, using BEA&apos;s own
          published U.S. total as the denominator. Quarter-over-quarter and
          year-over-year growth rates are computed per state, per industry,
          and for the U.S. total independently.
        </p>

        <p className="leading-7 text-muted">
          Figures on this page are sourced from the BEA SQGDP main-metrics
          endpoint (State Quarterly GDP table SQGDP9, real GDP by state and
          industry) and should not be interpreted as an official BEA
          release.
        </p>
      </section>
    </article>
  );
}
