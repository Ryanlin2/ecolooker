import { notFound } from "next/navigation";
import { getReport } from "@/lib/reports";
import { ReportHeader } from "@/components/blocks/ReportHeader";
import { MetricCard } from "@/components/blocks/MetricCard";
import { TrendChart } from "@/components/blocks/TrendChart";
import { InsightCallout } from "@/components/blocks/InsightCallout";
import { DataTable } from "@/components/blocks/DataTable";

const demoSeries = Array.from({ length: 12 }, (_, i) => ({
  x: `M${i + 1}`, y: 60 - i * 1.5 + Math.sin(i) * 4,
}));

export default async function ReportPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const r = getReport(slug);
  if (!r) notFound();

  // A report = ReportHeader + composed blocks. Author freely.
  return (
    <article className="mx-auto max-w-3xl">
      <ReportHeader title={r.title} subtitle={r.subtitle} date={r.date} tags={r.tags} />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MetricCard label={r.hero.label} value={r.hero.value} change={r.hero.change} />
        <MetricCard label="Cities tracked" value={128} change={2.4} />
        <MetricCard label="Data points" value={4200000} change={11.8} />
      </div>

      <p className="mb-4 leading-relaxed text-foreground/90">
        Particulate levels continued a gradual decline this quarter, extending the trend seen
        since late 2025. The improvement is broad but uneven — coastal metros outpaced inland ones.
      </p>

      <TrendChart title="Median AQI — trailing 12 months" data={demoSeries} positive />

      <InsightCallout>
        Three inland cities reversed the trend, driven by wildfire smoke drift. Filter for the
        &quot;Cities&quot; tag to compare against the regional baseline.
      </InsightCallout>

      <h3 className="mb-3 mt-8 text-lg font-semibold">Top movers</h3>
      <DataTable
        columns={["City", "AQI", "Δ QoQ", "Rank"]}
        rows={[
          ["Lisbon", 31, "-12%", 1],
          ["Vancouver", 34, "-9%", 2],
          ["Denver", 58, "+14%", 3],
        ]}
      />
    </article>
  );
}
