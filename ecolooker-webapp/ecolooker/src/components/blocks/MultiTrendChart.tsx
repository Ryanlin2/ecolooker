"use client";

import { useId } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader } from "@/components/ui/card";

export type MultiTrendSeries = {
  key: string;
  label: string;
  color?: string;
  dashed?: boolean;
};

type MultiTrendChartProps = {
  title?: string;
  description?: string;
  data: Record<string, string | number>[];
  series: MultiTrendSeries[];
  height?: number;
  valueFormatter?: (value: number) => string;
};

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullNumberFormatter = new Intl.NumberFormat("en-US");

const defaultColors = ["var(--signal)", "var(--accent)", "var(--danger)"];

export function MultiTrendChart({
  title,
  description,
  data,
  series,
  height = 260,
  valueFormatter = (value) => fullNumberFormatter.format(value),
}: MultiTrendChartProps) {
  const id = useId();

  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && (
            <h3 className="text-sm font-medium text-foreground">{title}</h3>
          )}

          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </CardHeader>
      )}

      <CardContent>
        {data.length > 0 ? (
          <div
            role="img"
            aria-label={title ? `${title} trend chart` : "Trend chart"}
          >
            <ResponsiveContainer width="100%" height={height}>
              <LineChart
                data={data}
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                accessibilityLayer
              >
                <CartesianGrid
                  vertical={false}
                  stroke="var(--border)"
                  strokeDasharray="3 3"
                  strokeOpacity={0.6}
                />

                <XAxis
                  dataKey="label"
                  axisLine={false}
                  tickLine={false}
                  minTickGap={20}
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(value: number) =>
                    compactNumberFormatter.format(value)
                  }
                  tick={{ fill: "var(--muted)", fontSize: 11 }}
                />

                <Tooltip
                  cursor={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
                  formatter={(value, name) => [
                    valueFormatter(Number(value)),
                    name,
                  ]}
                  labelFormatter={(label) => String(label)}
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--foreground)",
                  }}
                  labelStyle={{ color: "var(--foreground)", fontWeight: 600 }}
                />

                <Legend
                  wrapperStyle={{ fontSize: 11, color: "var(--muted)" }}
                  iconType="plainline"
                />

                {series.map((s, index) => (
                  <Line
                    key={`${id}-${s.key}`}
                    type="monotone"
                    dataKey={s.key}
                    name={s.label}
                    stroke={s.color ?? defaultColors[index % defaultColors.length]}
                    strokeWidth={2}
                    strokeDasharray={s.dashed ? "4 3" : undefined}
                    dot={false}
                    activeDot={{ r: 4 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div
            className="flex items-center justify-center text-sm text-muted"
            style={{ height }}
          >
            No trend data available.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
