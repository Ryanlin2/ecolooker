import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import { fmtNum } from "@/lib/utils";

export function MetricCard({ label, value, unit, change, prefix }: {
  label: string; value: number; unit?: string; change?: number; prefix?: string;
}) {
  const up = (change ?? 0) >= 0;
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
        <div className="mt-1 flex items-baseline gap-1">
          {prefix && <span className="text-muted">{prefix}</span>}
          <span className="tnum text-3xl font-semibold">{fmtNum(value)}</span>
          {unit && <span className="text-sm text-muted">{unit}</span>}
        </div>
        {change !== undefined && (
          <Badge tone={up ? "up" : "down"} className="mt-2">
            {up ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {fmtNum(Math.abs(change))}%
          </Badge>
        )}
      </CardContent>
    </Card>
  );
}
