"use client";

import { useEffect, useState } from "react";
import { MetricCard } from "./MetricCard";
import { TrendChart } from "./TrendChart";

type Snapshot = {
  metrics: {
    label: string;
    value: number;
    change: number;
    unit?: string;
  }[];
  series: {
    label: string;
    value: number;
  }[];
};

function seed(): Snapshot {
  const now = Date.now();

  return {
    metrics: [
      {
        label: "AQI Index",
        value: 42 + Math.random() * 20,
        change: (Math.random() - 0.5) * 8,
        unit: "",
      },
      {
        label: "CO₂ ppm",
        value: 415 + Math.random() * 10,
        change: (Math.random() - 0.5) * 3,
      },
      {
        label: "Active Sensors",
        value: 1280 + Math.floor(Math.random() * 40),
        change: (Math.random() - 0.4) * 5,
      },
    ],
    series: Array.from({ length: 24 }, (_, i) => ({
      label: `${new Date(
        now - (23 - i) * 3_600_000,
      ).getHours()}:00`,
      value: 40 + Math.sin(i / 3) * 12 + Math.random() * 6,
    })),
  };
}

export function LiveDashboard() {
  const [snap, setSnap] = useState<Snapshot>(seed);

  useEffect(() => {
    const id = window.setInterval(() => {
      setSnap(seed());
    }, 4000);

    return () => window.clearInterval(id);
  }, []);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span className="live-dot" />
        <span className="text-xs uppercase tracking-wide text-muted">
          Live · updates every 4s
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {snap.metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} />
        ))}
      </div>

      <div className="mt-4">
        <TrendChart
          title="Air Quality — 24h"
          data={snap.series}
          positive
        />
      </div>
    </section>
  );
}