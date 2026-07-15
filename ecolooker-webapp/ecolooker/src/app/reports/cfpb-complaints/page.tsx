// src/app/reports/cfpb-complaints/page.tsx

import type { Metadata } from "next";

import { DataTable } from "@/components/blocks/DataTable";
import { InsightCallout } from "@/components/blocks/InsightCallout";
import { MetricCard } from "@/components/blocks/MetricCard";
import { ReportHeader } from "@/components/blocks/ReportHeader";
import { TrendChart } from "@/components/blocks/TrendChart";

export const metadata: Metadata = {
  title: "Consumer Financial Protection Bureau",
  description: "Dashboard of consumer financial services complaints.",
};

/**
 * Seed data for UI development only.
 * Replace these values with CFPB API or database data before publication.
 */
const trendData = [
  { label: "Jan", value: 51_240 },
  { label: "Feb", value: 54_900 },
  { label: "Mar", value: 59_150 },
  { label: "Apr", value: 63_400 },
  { label: "May", value: 66_910 },
  { label: "Jun", value: 71_300 },
  { label: "Jul", value: 73_192 },
];

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

export default function CfpbComplaintsPage() {
  return (
    <article className="space-y-12">
      <ReportHeader
        title="Consumer Financial Protection Bureau"
        subtitle="Dashboard of consumer financial services complaints."
        date="Jul 2026"
        tags={["Complaints", "Consumer Finance", "Indicator"]}
      />

      <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted">
        This dashboard currently uses seed data for development and layout
        testing. Values should not be treated as official CFPB statistics.
      </div>

      <section
        aria-labelledby="key-metrics-heading"
        className="space-y-4"
      >
        <h2
          id="key-metrics-heading"
          className="text-sm uppercase tracking-wide text-muted"
        >
          Key metrics
        </h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Complaints YTD"
            value={470_092}
            change={8_452}
          />

          <MetricCard
            label="Latest month"
            value={73_192}
            change={1_892}
          />

          <MetricCard
            label="Timely response rate"
            value={98.1}
            change={0.7}
            unit="%"
          />

          <MetricCard
            label="Consumer relief"
            value={12.8}
            change={1.4}
            unit="M"
          />
        </div>
      </section>

      <TrendChart
        title="Monthly complaint volume"
        description="Consumer complaints received during the current reporting year."
        data={trendData}
      />

      <InsightCallout title="Primary signal">
        Complaint volume has increased for seven consecutive months. Credit
        reporting remains the largest category and accounts for almost half of
        all complaints in this demonstration dataset.
      </InsightCallout>

      <section className="grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <div className="space-y-5">
          <h2 className="text-2xl font-semibold tracking-tight">
            What the data shows
          </h2>

          <p className="leading-7 text-muted">
            Total complaint volume reached 470,092 during the year-to-date
            period. Monthly submissions increased from 51,240 in January to
            73,192 in July, representing growth of approximately 43 percent
            across the period.
          </p>

          <p className="leading-7 text-muted">
            Credit reporting generated the largest number of complaints,
            followed by debt collection and credit cards. Together, those
            categories represent more than four-fifths of complaints in the
            seed dataset.
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
              <dt className="text-muted">Intended source</dt>
              <dd className="mt-1">
                CFPB Consumer Complaint Database
              </dd>
            </div>

            <div>
              <dt className="text-muted">Current data status</dt>
              <dd className="mt-1">Seed data</dd>
            </div>

            <div>
              <dt className="text-muted">Reporting period</dt>
              <dd className="mt-1">January–July 2026</dd>
            </div>

            <div>
              <dt className="text-muted">Update frequency</dt>
              <dd className="mt-1">Monthly</dd>
            </div>

            <div>
              <dt className="text-muted">Last updated</dt>
              <dd className="mt-1">
                <time dateTime="2026-07-01">July 2026</time>
              </dd>
            </div>
          </dl>
        </aside>
      </section>

      <section
        aria-labelledby="product-breakdown-heading"
        className="space-y-4"
      >
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
            {
              key: "product",
              label: "Product",
            },
            {
              key: "complaints",
              label: "Complaints",
            },
            {
              key: "share",
              label: "Share (%)",
            },
            {
              key: "change",
              label: "YoY change (%)",
            },
            {
              key: "timelyResponse",
              label: "Timely response (%)",
            },
          ]}
          rows={productRows}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight">
          Methodology
        </h2>

        <p className="leading-7 text-muted">
          The values displayed on this page are synthetic seed data created to
          test the report interface. They illustrate the intended structure of
          complaint volumes, product shares, annual changes, and company
          response rates.
        </p>

        <p className="leading-7 text-muted">
          In production, the application should retrieve records from the CFPB
          Consumer Complaint Database, normalize product names, remove duplicate
          records, and aggregate complaints by submission date and product
          category. Percentage changes should be calculated against an
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