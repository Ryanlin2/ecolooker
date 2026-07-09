"use client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

type Point = { x: string | number; y: number };

export function TrendChart({ title, data, positive = true, height = 240 }: {
  title?: string; data: Point[]; positive?: boolean; height?: number;
}) {
  const color = positive ? "var(--signal)" : "var(--danger)";
  return (
    <Card>
      {title && <CardHeader><h3 className="text-sm font-medium text-muted">{title}</h3></CardHeader>}
      <CardContent>
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={`g-${positive}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                <stop offset="100%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="x" tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--foreground)" }} />
            <Area type="monotone" dataKey="y" stroke={color} strokeWidth={2} fill={`url(#g-${positive})`} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
