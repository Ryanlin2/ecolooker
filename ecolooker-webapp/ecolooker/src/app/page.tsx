// src/app/page.tsx

import Link from "next/link";
import { reports } from "@/lib/reports";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TypewriterText } from "@/components/ui/typewriter-text";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fmtNum } from "@/lib/utils";

export default function Home() {
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
          <TypewriterText text="Objective: Catalog and analyze heterogenous datasets detailing global economic mechanisms at different scales." />
        </p>
      </section>

      <h2 className="mb-4 text-sm uppercase tracking-wide text-muted">
        Report Catalog
      </h2>

      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((report) => {
          const up = report.hero.change >= 0;

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
                      <p className="text-xs text-muted">{report.hero.label}</p>

                      <p className="tnum text-2xl font-semibold">
                        {fmtNum(report.hero.value)}
                      </p>
                    </div>

                    <Badge tone={up ? "up" : "down"}>
                      {up ? (
                        <ArrowUpRight size={12} />
                      ) : (
                        <ArrowDownRight size={12} />
                      )}

                      {fmtNum(Math.abs(report.hero.change))}
                    </Badge>
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