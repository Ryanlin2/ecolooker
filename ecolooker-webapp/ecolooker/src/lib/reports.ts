/* Report registry. Add an entry here to publish a new report.
   Keep content in code (or migrate to MDX/CMS later) — the UI never changes. */
export type ReportMeta = {
  slug: string; title: string; subtitle: string; date: string; tags: string[];
  hero: { label: string; value: number; change: number; unit?: string };
};

export const reports: ReportMeta[] = [
  {
    slug: "cfpb-complaints",
    title: "Consumer Financial Protection Bureau Anomaly Dashboard",
    subtitle: "Live dashboard of financial services complaints.",
    date: "Jul 2026",
    tags: ["Complaints", "Indicator"],
    hero: { label: "Net Compalaints YTD", value: 470092, change: 8452 },
  }
];

export const getReport = (slug: string) => reports.find((r) => r.slug === slug);
