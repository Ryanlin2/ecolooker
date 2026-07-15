// src/components/blocks/BarGraph.tsx

type Bar = {
  label: string;
  value: number;
};

type BarGraphProps = {
  title: string;
  description?: string;
  data: Bar[];
  unit?: string;
  positive?: boolean;
};

export function BarGraph({
  title,
  description,
  data,
  unit = "",
  positive,
}: BarGraphProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <figure className="rounded-xl border bg-surface p-5">
      <figcaption className="mb-6">
        <div className="flex items-baseline justify-between gap-4">
          <span className="font-semibold">{title}</span>

          <span className="tnum shrink-0 text-xs text-muted">
            peak {max.toLocaleString()}
            {unit}
          </span>
        </div>

        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </figcaption>

      <div className="flex h-56 items-end gap-2">
        {data.map((bar) => (
          <div
            key={bar.label}
            className="flex h-full flex-1 flex-col items-center justify-end"
          >
            <span className="tnum mb-1 shrink-0 text-[10px] font-medium">
              {bar.value.toLocaleString()}
              {unit}
            </span>

            <div
              className={`w-full shrink-0 rounded-t ${
                positive ? "bg-emerald-500/70" : "bg-sky-500/70"
              }`}
              style={{ height: `${Math.max((bar.value / max) * 100, 0.5)}%` }}
            />
          </div>
        ))}
      </div>

      <div className="mt-2 flex gap-2">
        {data.map((bar) => (
          <span
            key={bar.label}
            className="flex-1 truncate text-center text-[10px] text-muted"
          >
            {bar.label}
          </span>
        ))}
      </div>
    </figure>
  );
}