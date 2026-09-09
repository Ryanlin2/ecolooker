// src/app/page.tsx

import Link from "next/link";
import { reports } from "@/lib/reports";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TypewriterText } from "@/components/ui/typewriter-text";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fmtNum } from "@/lib/utils";
import { getCfpbReport } from "@/lib/cfpb-data";
import { getUsIndustryGdpReport } from "@/lib/gdp-data";

type Hero = { label: string; value: number; change: number } | null;

async function getHeroBySlug(): Promise<Record<string, Hero>> {
  const [cfpb, gdp] = await Promise.allSettled([
    getCfpbReport(),
    getUsIndustryGdpReport(),
  ]);

  const latestCfpbDay =
    cfpb.status === "fulfilled" ? cfpb.value.volumeDaily.at(-1) : undefined;

  return {
    "cfpb-complaints": latestCfpbDay
      ? {
          label: "Complaints received",
          value: latestCfpbDay.complaints,
          change: latestCfpbDay.dodChange,
        }
      : null,
    "us-industry-gdp":
      gdp.status === "fulfilled"
        ? {
            label: "National Real GDP",
            value: Math.round(gdp.value.nationalGdpMillions / 1000),
            change: gdp.value.nationalQoqPctChange,
          }
        : null,
  };
}

export default async function Home() {
  const heroBySlug = await getHeroBySlug();

  return (
    <div>
      <section className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-signal">
          Economic Data Intelligence
        </p>

        <h1 className="mt-2 max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">
          Ecolooker
        </h1>

        <p className="mt-3 max-w-xl font-mono text-sm text-muted sm:text-base">
          <TypewriterText text="Objective: Catalog and analyze different datasets detailing global economic mechanisms at different scales." />
        </p>
      </section>

      <h2 className="mb-4 text-sm uppercase tracking-wide text-muted">
        Report Catalog
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => {
          const hero = heroBySlug[report.slug];
          const up = (hero?.change ?? 0) >= 0;

          return (
            <Link key={report.slug} href={`/dashboards/${report.slug}`}>
              <Card className="transition hover:border-accent">
                <CardContent className="pt-5">
                  <div className="flex flex-wrap gap-2">
                    {report.tags.map((tag) => (
                      <Badge key={tag} tone="accent">
                        {tag}
                      </Badge>
                    ))}
                  </div>

                  <h3 className="mt-3 text-lg font-semibold">{report.title}</h3>

                  <p className="mt-1 text-sm text-muted">{report.subtitle}</p>

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted">{hero?.label ?? "—"}</p>

                      <p className="tnum text-2xl font-semibold">
                        {hero ? fmtNum(hero.value) : "—"}
                      </p>
                    </div>

                    {hero && (
                      <Badge tone={up ? "up" : "down"}>
                        {up ? (
                          <ArrowUpRight size={12} />
                        ) : (
                          <ArrowDownRight size={12} />
                        )}

                        {fmtNum(Math.abs(hero.change))}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}