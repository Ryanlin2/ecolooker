/* Report registry. Add an entry here to publish a new report.
   Keep content in code (or migrate to MDX/CMS later) — the UI never changes. */
export type ReportMeta = {
  slug: string; title: string; subtitle: string; date: string; tags: string[];
  hero: { label: string; value: number; change: number; unit?: string };
};

export const reports: ReportMeta[] = [
  {
    slug: "urban-air-2026",
    title: "Urban Air Quality Signals — Q2 2026",
    subtitle: "Where particulate trends are improving, and the three cities bucking the pattern.",
    date: "Jul 2026",
    tags: ["Air", "Cities", "Analysis"],
    hero: { label: "Median AQI", value: 47, change: -6.2 },
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
