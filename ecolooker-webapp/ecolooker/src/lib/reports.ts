/* Report registry. Add an entry here to publish a new report.
   Keep content in code (or migrate to MDX/CMS later) — the UI never changes.
   Hero stats are fetched live per-report (see src/app/page.tsx) rather than
   stored here, since they'd otherwise go stale the moment the underlying
   data updates. */
export type ReportMeta = {
  slug: string; title: string; subtitle: string; tags: string[];
};

export const reports: ReportMeta[] = [
  {
    slug: "cfpb-complaints",
    title: "Consumer Financial Protection Bureau Anomaly Dashboard",
    subtitle: "Live dashboard of financial services complaints.",
    tags: ["Complaints", "Indicator"],
  },
  {
    slug: "us-industry-gdp",
    title: "United States Industry GDP Dashboard",
    subtitle: "State-level real GDP and industry composition across the US economy.",
    tags: ["GDP", "Industry", "Macroeconomics"],
  },
];

export const getReport = (slug: string) => reports.find((r) => r.slug === slug);
