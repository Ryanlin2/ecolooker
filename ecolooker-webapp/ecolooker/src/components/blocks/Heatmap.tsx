export type HeatmapCell = {
  row: string;
  column: string;
  value: number;
  label?: string;
};

type HeatmapProps = {
  title?: string;
  description?: string;
  data: HeatmapCell[];
  valueSuffix?: string;
  accentVar?: string;
};

export function Heatmap({
  title,
  description,
  data,
  valueSuffix = "%",
  accentVar = "--accent",
}: HeatmapProps) {
  const rows = [...new Set(data.map((cell) => cell.row))];
  const columns = [...new Set(data.map((cell) => cell.column))];
  const max = Math.max(...data.map((cell) => cell.value), 1);

  const lookup = new Map(
    data.map((cell) => [`${cell.row}__${cell.column}`, cell]),
  );

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border bg-surface p-3 sm:p-5">
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="font-semibold">{title}</h3>}
          {description && (
            <p className="mt-1 text-sm text-muted">{description}</p>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-separate [border-spacing:4px]">
          <thead>
            <tr>
              <th className="sticky left-0 bg-surface px-2 py-1 text-left text-xs font-medium text-muted">
                Product
              </th>
              {columns.map((column) => (
                <th
                  key={column}
                  className="max-w-[9rem] px-2 py-1 text-left text-xs font-medium text-muted"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row}>
                <th
                  scope="row"
                  className="sticky left-0 max-w-[10rem] whitespace-normal bg-surface px-2 py-2 text-left text-sm font-medium"
                >
                  {row}
                </th>

                {columns.map((column) => {
                  const cell = lookup.get(`${row}__${column}`);
                  const intensity = cell ? Math.round((cell.value / max) * 100) : 0;

                  return (
                    <td
                      key={column}
                      className="rounded-md px-2 py-2 text-center align-middle"
                      style={{
                        backgroundColor: cell
                          ? `color-mix(in srgb, var(${accentVar}) ${intensity}%, var(--surface))`
                          : "var(--surface-2)",
                      }}
                      title={
                        cell
                          ? `${row} — ${column}: ${cell.label ?? cell.value}${valueSuffix}`
                          : undefined
                      }
                    >
                      {cell ? (
                        <span
                          className={`tnum text-xs font-medium ${
                            intensity > 55 ? "text-white" : "text-foreground"
                          }`}
                        >
                          {cell.label ?? cell.value}
                          {valueSuffix}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-muted">
        Darker cells indicate a higher share of that product&apos;s complaints.
      </p>
    </div>
  );
}
