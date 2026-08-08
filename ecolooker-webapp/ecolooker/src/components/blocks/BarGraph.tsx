type Bar = {
  label: string;
  value: number;
};

type BarGraphProps = {
  title: string;
  description?: string;
  data: Bar[];
  unit?: string;
};

export function BarGraph({
  title,
  description,
  data,
  unit = "",
}: BarGraphProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  const columnStyle = {
    gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))`,
  };

  return (
    <figure className="w-full min-w-0 overflow-hidden rounded-xl border bg-surface p-3 sm:p-5">
      <figcaption className="mb-6 min-w-0">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <span className="min-w-0 font-semibold">{title}</span>

          <span className="tnum shrink-0 text-xs text-muted">
            peak {max.toLocaleString()}
            {unit}
          </span>
        </div>

        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </figcaption>

      <div
        className="grid h-56 min-w-0 items-end gap-1 sm:gap-2"
        style={columnStyle}
      >
        {data.map((bar) => (
          <div
            key={bar.label}
            className="flex h-full min-w-0 flex-col items-center justify-end"
            aria-label={`${bar.label}: ${bar.value.toLocaleString()}${unit}`}
          >
            <span
              className="tnum mb-1 max-w-full overflow-hidden text-ellipsis whitespace-nowrap text-[9px] font-medium sm:text-[10px]"
              title={`${bar.value.toLocaleString()}${unit}`}
            >
              {bar.value.toLocaleString()}
              {unit}
            </span>

            <div
              className="w-full min-w-0 rounded-t bg-signal/70"
              style={{
                height: `${Math.max((bar.value / max) * 100, 0.5)}%`,
              }}
            />
          </div>
        ))}
      </div>

      <div
        className="mt-2 grid min-w-0 gap-1 sm:gap-2"
        style={columnStyle}
      >
        {data.map((bar) => (
          <span
            key={bar.label}
            className="min-w-0 whitespace-normal break-words text-center text-[9px] leading-tight text-muted sm:text-[10px]"
          >
            {bar.label}
          </span>
        ))}
      </div>
    </figure>
  );
}