import type { ReactNode } from "react";

type TableValue = string | number | null | undefined;

export type DataTableColumn<Row extends Record<string, TableValue>> = {
  key: keyof Row;
  label: string;
  align?: "left" | "center" | "right";
  format?: (value: TableValue, row: Row) => ReactNode;
};

type DataTableProps<Row extends Record<string, TableValue>> = {
  title?: string;
  description?: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  emptyMessage?: string;
};

export function DataTable<Row extends Record<string, TableValue>>({
  title,
  description,
  columns,
  rows,
  emptyMessage = "No data available.",
}: DataTableProps<Row>) {
  return (
    <div className="overflow-hidden rounded-xl border bg-surface">
      {(title || description) && (
        <div className="border-b px-4 py-4">
          {title && (
            <h3 className="text-sm font-semibold text-foreground">
              {title}
            </h3>
          )}

          {description && (
            <p className="mt-1 text-sm text-muted">
              {description}
            </p>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr className="border-b bg-surface-2 text-muted">
              {columns.map((column) => (
                <th
                  key={String(column.key)}
                  scope="col"
                  className={[
                    "whitespace-nowrap px-4 py-3 font-medium",
                    getAlignmentClass(column.align ?? "left"),
                  ].join(" ")}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length > 0 ? (
              rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b transition-colors last:border-0 hover:bg-surface-2"
                >
                  {columns.map((column) => {
                    const value = row[column.key];
                    const isNumeric = typeof value === "number";

                    return (
                      <td
                        key={String(column.key)}
                        className={[
                          "whitespace-nowrap px-4 py-3",
                          isNumeric ? "tnum" : "",
                          getAlignmentClass(column.align ?? "left"),
                        ].join(" ")}
                      >
                        {column.format
                          ? column.format(value, row)
                          : formatCellValue(value)}
                      </td>
                    );
                  })}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-10 text-center text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getAlignmentClass(
  alignment: "left" | "center" | "right",
) {
  switch (alignment) {
    case "center":
      return "text-center";
    case "right":
      return "text-right";
    default:
      return "text-left";
  }
}

function formatCellValue(value: TableValue) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "number") {
    return new Intl.NumberFormat("en-US").format(value);
  }

  return value;
}