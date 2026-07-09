export function DataTable({ columns, rows }: {
  columns: string[]; rows: (string | number)[][];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-surface">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted">
            {columns.map((c) => <th key={c} className="px-4 py-3 font-medium">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b last:border-0 hover:bg-surface-2">
              {r.map((cell, j) => (
                <td key={j} className={j === 0 ? "px-4 py-3" : "px-4 py-3 tnum"}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
