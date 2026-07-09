"use client";
import { useEffect, useState } from "react";
import { MetricCard } from "./MetricCard";
import { TrendChart } from "./TrendChart";

/* Live dashboard: same blocks, data refreshes on an interval.
   Swap `poll` for your real fetcher (REST/websocket) in lib/data.ts */
type Snapshot = { metrics: { label: string; value: number; change: number; unit?: string }[]; series: { x: string; y: number }[] };

function seed(): Snapshot {
  const s: Snapshot = { metrics: [], series: [] };
  s.metrics = [
    { label: "AQI Index", value: 42 + Math.random() * 20, change: (Math.random() - 0.5) * 8, unit: "" },
    { label: "CO₂ ppm", value: 415 + Math.random() * 10, change: (Math.random() - 0.5) * 3 },
    { label: "Active Sensors", value: 1280 + Math.floor(Math.random() * 40), change: (Math.random() - 0.4) * 5 },
  ];
  const now = Date.now();
  s.series = Array.from({ length: 24 }, (_, i) => ({
    x: new Date(now - (23 - i) * 3600e3).getHours() + ":00",
    y: 40 + Math.sin(i / 3) * 12 + Math.random() * 6,
  }));
  return s;
}

export function LiveDashboard() {
  const [snap, setSnap] = useState<Snapshot>(seed);
  useEffect(() => {
    const id = setInterval(() => setSnap(seed()), 4000);
    return () => clearInterval(id);
  }, []);
  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="live-dot" />
        <span className="text-xs uppercase tracking-wide text-muted">Live · updates every 4s</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {snap.metrics.map((m) => <MetricCard key={m.label} {...m} />)}
      </div>
      <div className="mt-4">
        <TrendChart title="Air Quality — 24h" data={snap.series} positive />
      </div>
    </section>
  );
}
