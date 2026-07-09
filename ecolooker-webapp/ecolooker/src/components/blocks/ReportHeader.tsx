import { Badge } from "@/components/ui/badge";

export function ReportHeader({ title, subtitle, date, tags = [] }: {
  title: string; subtitle?: string; date?: string; tags?: string[];
}) {
  return (
    <header className="mb-8 border-b pb-6">
      <div className="flex flex-wrap gap-2">
        {tags.map((t) => <Badge key={t} tone="accent">{t}</Badge>)}
      </div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
      {subtitle && <p className="mt-2 max-w-2xl text-muted">{subtitle}</p>}
      {date && <p className="mt-3 text-xs uppercase tracking-wide text-muted">{date}</p>}
    </header>
  );
}
