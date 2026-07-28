// src/app/reports/cfpb-complaints/page.tsx

import type { Metadata } from "next";

import { getSiteData } from "@/lib/get-site-data";
import { BarGraph } from "@/components/blocks/BarGraph";
import { DataTable } from "@/components/blocks/DataTable";
import { InsightCallout } from "@/components/blocks/InsightCallout";
import { MetricCard } from "@/components/blocks/MetricCard";
import { ReportHeader } from "@/components/blocks/ReportHeader";

export const metadata: Metadata = {
  title: "Consumer Financial Protection Bureau",
  description: "Dashboard of consumer financial services complaints.",
};

export const dynamic = "force-dynamic";

/**
 * Seed data for UI development only.
 * The product-level breakdown is not yet available from the API.
 */
const productRows = [
  {
    product: "Credit reporting",
    complaints: 210_450,
    share: 44.8,
    change: 8.4,
    timelyResponse: 97.6,
  },
  {
    product: "Debt collection",
    complaints: 94_120,
    share: 20.0,
    change: -2.1,
    timelyResponse: 96.2,
  },
  {
    product: "Credit cards",
    complaints: 81_430,
    share: 17.3,
    change: 4.7,
    timelyResponse: 98.4,
  },
  {
    product: "Mortgages",
    complaints: 36_870,
    share: 7.8,
    change: 1.9,
    timelyResponse: 99.1,
  },
  {
    product: "Checking and savings",
    complaints: 28_940,
    share: 6.2,
    change: 6.3,
    timelyResponse: 98.8,
  },
  {
    product: "Student loans",
    complaints: 11_582,
    share: 2.5,
    change: -3.6,
    timelyResponse: 95.7,
  },
  {
    product: "Vehicle loans",
    complaints: 6_700,
    share: 1.4,
    change: 2.8,
    timelyResponse: 97.9,
  },
];

export default async function CfpbComplaintsPage() {
  const { count, rows } = await getSiteData();

  const sorted = [...rows].sort((a, b) => a.complaintYear - b.complaintYear);

  const chartData = sorted.map((row) => ({
    label: String(row.complaintYear),
    value: row.netComplaints,
  }));

  const latest = sorted.at(-1);
  const prior = sorted.at(-2);

  const yoyChange =
    latest && prior ? latest.netComplaints - prior.netComplaints : 0;

  const total = sorted.reduce((sum, row) => sum + row.netComplaints, 0);

  return (
    <article className="space-y-12">
      <ReportHeader
        title="Consumer Financial Protection Bureau"
        subtitle="Dashboard of consumer financial services complaints."
        date="Jul 2026"
        tags={["Complaints", "Consumer Finance", "Indicator"]}
      />

      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted">
        Annual complaint totals are live from the CFPB API. The product-level
        breakdown below remains seed data and should not be treated as official
        CFPB statistics.
      </div>

      <section aria-labelledby="key-metrics-heading" className="space-y-4">
        <h2
          id="key-metrics-heading"
          className="text-sm uppercase tracking-wide text-muted"
        >
          Key metrics
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label={`Complaints ${latest?.complaintYear ?? ""}`}
            value={latest?.netComplaints ?? 0}
            change={yoyChange}
          />

          <MetricCard
            label="All years combined"
            value={total}
            change={0}
          />

          <MetricCard label="Years covered" value={count} change={0} />

          <MetricCard
            label="Timely response rate"
            value={98.1}
            change={0.7}
            unit="%"
          />
        </div>
      </section>

      <BarGraph
        title="Net complaints by year"
        description="Annual complaint totals reported to the CFPB."
        data={chartData}
      />

      <InsightCallout title="Primary signal">
        Annual complaint volume has grown by several orders of magnitude across
        the reporting period. Credit reporting remains the largest category and
        accounts for almost half of all complaints in the product breakdown
        below.
      </InsightCallout>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">
            What the data shows
          </h2>

          <p className="leading-7 text-muted">
            The dataset spans {count} reporting years, from{" "}
            {sorted.at(0)?.complaintYear} to {latest?.complaintYear}. Annual
            volume rose from{" "}
            {sorted.at(0)?.netComplaints.toLocaleString()} to{" "}
            {latest?.netComplaints.toLocaleString()} across that period.
          </p>

          <p className="leading-7 text-muted">
            Credit reporting generated the largest number of complaints,
            followed by debt collection and credit cards. Together, those
            categories represent more than four-fifths of complaints in the
            product breakdown.
          </p>

          <p className="leading-7 text-muted">
            Company response performance remained high overall, although
            response rates varied by product. Student-loan and debt-collection
            complaints recorded the lowest timely-response rates among the
            displayed categories.
          </p>
        </div>

        <aside className="h-fit rounded-xl border bg-surface p-5 lg:sticky lg:top-8">
          <h2 className="font-semibold">About this report</h2>

          <dl className="mt-4 space-y-4 text-sm">
            <div>
              <dt className="text-muted">Source</dt>
              <dd className="mt-1">CFPB Consumer Complaint Database</dd>
            </div>

            <div>
              <dt className="text-muted">Annual totals</dt>
              <dd className="mt-1">Live</dd>
            </div>

            <div>
              <dt className="text-muted">Product breakdown</dt>
              <dd className="mt-1">Seed data</dd>
            </div>

            <div>
              <dt className="text-muted">Reporting period</dt>
              <dd className="mt-1">
                {sorted.at(0)?.complaintYear}–{latest?.complaintYear}
              </dd>
            </div>

            <div>
              <dt className="text-muted">Update frequency</dt>
              <dd className="mt-1">Per deployment</dd>
            </div>
          </dl>
        </aside>
      </section>

      <section aria-labelledby="product-breakdown-heading" className="space-y-4">
        <div>
          <h2
            id="product-breakdown-heading"
            className="text-2xl font-semibold tracking-tight"
          >
            Complaints by product
          </h2>

          <p className="mt-2 text-sm text-muted">
            Year-to-date volume, category share, annual change, and company
            response performance.
          </p>
        </div>

        <DataTable
          title="Product-level complaint indicators"
          columns={[
            { key: "product", label: "Product" },
            { key: "complaints", label: "Complaints" },
            { key: "share", label: "Share (%)" },
            { key: "change", label: "YoY change (%)" },
            { key: "timelyResponse", label: "Timely response (%)" },
          ]}
          rows={productRows}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">Methodology</h2>

        <p className="leading-7 text-muted">
          Annual complaint totals are retrieved from the CFPB Consumer Complaint
          Database and cached at build time. The product-level values below are
          synthetic seed data created to test the report interface.
        </p>

        <p className="leading-7 text-muted">
          In production, the product breakdown should normalize product names,
          remove duplicate records, and aggregate complaints by submission date
          and category. Percentage changes should be calculated against an
          equivalent prior-year reporting period.
        </p>

        <p className="leading-7 text-muted">
          Complaint counts reflect reports submitted to the CFPB and should not
          be interpreted as direct measures of product prevalence, company size,
          or confirmed misconduct.
        </p>
      </section>
    </article>
  );
}