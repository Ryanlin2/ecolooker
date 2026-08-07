import Link from "next/link";

import { DataTable, type DataTableColumn } from "./DataTable";
import { cn } from "@/lib/utils";

type TableValue = string | number | null | undefined;

type PaginatedDataTableProps<Row extends Record<string, TableValue>> = {
  title?: string;
  description?: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  page: number;
  pageSize?: number;
  pageParam?: string;
  emptyMessage?: string;
};

/**
 * Server-rendered pagination: page state lives in the URL (?<pageParam>=N)
 * rather than client state, so `columns[].format` render functions can stay
 * plain functions instead of crossing a client-component boundary.
 */
export function PaginatedDataTable<Row extends Record<string, TableValue>>({
  title,
  description,
  columns,
  rows,
  page,
  pageSize = 25,
  pageParam = "page",
  emptyMessage,
}: PaginatedDataTableProps<Row>) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), pageCount);

  const start = (currentPage - 1) * pageSize;
  const pageRows = rows.slice(start, start + pageSize);

  return (
    <div className="space-y-3">
      <DataTable
        title={title}
        description={description}
        columns={columns}
        rows={pageRows}
        emptyMessage={emptyMessage}
      />

      {rows.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted">
          <span>
            Showing {start + 1}–{Math.min(start + pageSize, rows.length)} of{" "}
            {rows.length}
          </span>

          <Pager
            page={currentPage}
            pageCount={pageCount}
            pageParam={pageParam}
          />
        </div>
      )}
    </div>
  );
}

function Pager({
  page,
  pageCount,
  pageParam,
}: {
  page: number;
  pageCount: number;
  pageParam: string;
}) {
  const pages = pageNumbers(page, pageCount);

  return (
    <nav className="flex items-center gap-1" aria-label="Pagination">
      <PagerLink
        label="Prev"
        targetPage={page - 1}
        disabled={page <= 1}
        pageParam={pageParam}
      />

      {pages.map((entry, i) =>
        entry === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-muted">
            &hellip;
          </span>
        ) : (
          <PagerLink
            key={entry}
            label={String(entry)}
            targetPage={entry}
            active={entry === page}
            pageParam={pageParam}
          />
        )
      )}

      <PagerLink
        label="Next"
        targetPage={page + 1}
        disabled={page >= pageCount}
        pageParam={pageParam}
      />
    </nav>
  );
}

function PagerLink({
  label,
  targetPage,
  active,
  disabled,
  pageParam,
}: {
  label: string;
  targetPage: number;
  active?: boolean;
  disabled?: boolean;
  pageParam: string;
}) {
  const className = cn(
    "min-w-8 rounded-lg border px-2 py-1 text-center text-xs font-medium transition-colors",
    active
      ? "border-foreground/20 bg-surface-2 text-foreground"
      : "border-transparent text-muted hover:bg-surface-2",
    disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
  );

  if (disabled) {
    return (
      <span className={className} aria-disabled="true">
        {label}
      </span>
    );
  }

  return (
    <Link
      href={`?${pageParam}=${targetPage}`}
      scroll={false}
      aria-current={active ? "page" : undefined}
      className={className}
    >
      {label}
    </Link>
  );
}

function pageNumbers(
  page: number,
  pageCount: number
): (number | "ellipsis")[] {
  const delta = 1;
  const range: (number | "ellipsis")[] = [];
  let lastShown = 0;

  for (let p = 1; p <= pageCount; p++) {
    const show = p === 1 || p === pageCount || Math.abs(p - page) <= delta;

    if (!show) continue;

    if (lastShown && p - lastShown > 1) {
      range.push("ellipsis");
    }

    range.push(p);
    lastShown = p;
  }

  return range;
}
