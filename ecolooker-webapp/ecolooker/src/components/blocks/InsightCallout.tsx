import { Lightbulb } from "lucide-react";

export function InsightCallout({ children, title = "Insight" }: {
  children: React.ReactNode; title?: string;
}) {
  return (
    <div className="my-4 flex gap-3 rounded-xl border border-l-2 bg-surface p-4"
      style={{ borderLeftColor: "var(--accent)" }}>
      <Lightbulb className="mt-0.5 shrink-0 text-accent" size={18} />
      <div>
        <p className="text-sm font-semibold text-accent">{title}</p>
        <p className="mt-1 text-sm text-foreground/90">{children}</p>
      </div>
    </div>
  );
}
