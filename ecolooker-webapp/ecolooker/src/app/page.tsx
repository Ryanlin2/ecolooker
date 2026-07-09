import Link from "next/link";
import { reports } from "@/lib/reports";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fmtNum } from "@/lib/utils";

export default function Home() {
  return (
    <div>
      <section className="mb-10">
        <p className="text-xs uppercase tracking-[0.2em] text-signal">Environmental Data Intelligence</p>
        <h1 className="mt-2 max-w-2xl text-4xl font-bold tracking-tight md:text-5xl">
          Signals from the planet, read like a market.
        </h1>
        <p className="mt-3 max-w-xl text-muted">
          Analysis reports, insights, and live dashboards on the environmental metrics that move.
        </p>
      </section>

      <h2 className="mb-4 text-sm uppercase tracking-wide text-muted">Latest reports</h2>
      <div className="grid gap-4 md:grid-cols-2">
        {reports.map((r) => {
          const up = r.hero.change >= 0;
          return (
            <Link key={r.slug} href={`/reports/${r.slug}`}>
              <Card className="transition hover:border-accent">
                <CardContent className="pt-5">
                  <div className="flex flex-wrap gap-2">
                    {r.tags.map((t) => <Badge key={t} tone="accent">{t}</Badge>)}
                  </div>
                  <h3 className="mt-3 text-lg font-semibold">{r.title}</h3>
                  <p className="mt-1 text-sm text-muted">{r.subtitle}</p>
                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted">{r.hero.label}</p>
                      <p className="tnum text-2xl font-semibold">{fmtNum(r.hero.value)}</p>
                    </div>
                    <Badge tone={up ? "up" : "down"}>
                      {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {fmtNum(Math.abs(r.hero.change))}%
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
