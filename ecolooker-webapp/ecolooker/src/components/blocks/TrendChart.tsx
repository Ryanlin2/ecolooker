"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";

export type TrendPoint = {
  label: string | number;
  value: number;
};

type TrendChartProps = {
  title?: string;
  description?: string;
  data: TrendPoint[];
  positive?: boolean;
  height?: number;
  valueLabel?: string;
  valueFormatter?: (value: number) => string;
};

const compactNumberFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullNumberFormatter = new Intl.NumberFormat("en-US");

export function TrendChart({
  title,
  description,
  data,
  positive = true,
  height = 240,
  valueLabel = "Value",
  valueFormatter = (value) => fullNumberFormatter.format(value),
}: TrendChartProps) {
  const id = useId();
  const gradientId = `trend-gradient-${id.replace(/:/g, "")}`;
  const color = positive ? "var(--signal)" : "var(--danger)";

  return (
    <Card>
      {(title || description) && (
        <CardHeader>
          {title && (
            <h3 className="text-sm font-medium text-foreground">
              {title}
            </h3>
          )}

          {description && (
            <p className="mt-1 text-sm text-muted">
              {description}
            </p>
          )}
        </CardHeader>
      )}

      <CardContent>
        {data.length > 0 ? (
          <div
            role="img"
            aria-label={
              title
                ? `${title} trend chart`
                : "Trend chart"
            }
          >
            <ResponsiveContainer width="100%" height={height}>
              <AreaChart
                data={data}
                margin={{
                  top: 8,
                  right: 8,
                  bottom: 0,
                  left: 0,
                }}
                accessibilityLayer
              >
                <defs>
                  <linearGradient
                    id={gradientId}
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="0%"
                      stopColor={color}
                      stopOpacity={0.35}
                    />
                    <stop
                      offset="100%"
                      stopColor={color}
                      stopOpacity={0}
                    />
                  </linearGradient>
                </defs>

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
                  minTickGap={16}
                  tick={{
                    fill: "var(--muted)",
                    fontSize: 11,
                  }}
                />

                <YAxis
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(value: number) =>
                    compactNumberFormatter.format(value)
                  }
                  tick={{
                    fill: "var(--muted)",
                    fontSize: 11,
                  }}
                />

                <Tooltip
                  cursor={{
                    stroke: "var(--border)",
                    strokeDasharray: "3 3",
                  }}
                  formatter={(value) => [
                    valueFormatter(Number(value)),
                    valueLabel,
                  ]}
                  labelFormatter={(label) => String(label)}
                  contentStyle={{
                    background: "var(--surface-2)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    color: "var(--foreground)",
                  }}
                  labelStyle={{
                    color: "var(--foreground)",
                    fontWeight: 600,
                  }}
                  itemStyle={{
                    color,
                  }}
                />

                <Area
                  type="monotone"
                  dataKey="value"
                  name={valueLabel}
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#${gradientId})`}
                  fillOpacity={1}
                  activeDot={{
                    r: 4,
                    fill: color,
                    stroke: "var(--surface)",
                    strokeWidth: 2,
                  }}
                />
              </AreaChart>
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