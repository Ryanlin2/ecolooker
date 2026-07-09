import * as React from "react";
import { cn } from "@/lib/utils";

export function Badge({ className, tone = "neutral", ...props }:
  React.HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "up" | "down" | "accent" }) {
  const tones = {
    neutral: "bg-surface-2 text-muted",
    up: "text-signal", down: "text-danger",
    accent: "text-accent",
  } as const;
  return <span className={cn(
    "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium",
    tones[tone], className)} {...props} />;
}
