/* Report registry. Add an entry here to publish a new report.
   Keep content in code (or migrate to MDX/CMS later) — the UI never changes. */
export type ReportMeta = {
  slug: string; title: string; subtitle: string; date: string; tags: string[];
  hero: { label: string; value: number; change: number; unit?: string };
};

export const reports: ReportMeta[] = [
  {
    slug: "cfpb complaints",
    title: "Consumer Financial Protection Bureau",
    subtitle: "Live dashboard of financial services complaints.",
    date: "Jul 2026",
    tags: ["Complaints", "Indicator"],
    hero: { label: "Net Compalints YTD", value: 470092, change: +8452 },
  },
  {
    slug: "grid-carbon",
    title: "Grid Carbon Intensity Watch",
    subtitle: "Real-time decarbonization pace across regional grids.",
    date: "Jul 2026",
    tags: ["Energy", "Live"],
    hero: { label: "gCO₂/kWh", value: 312, change: -4.1 },
  },
];

export const getReport = (slug: string) => reports.find((r) => r.slug === slug);
