"use client";

import { useState } from "react";

import { DataTable, type DataTableColumn } from "./DataTable";
import { cn } from "@/lib/utils";

type TableValue = string | number | null | undefined;

type PaginatedDataTableProps<Row extends Record<string, TableValue>> = {
  title?: string;
  description?: string;
  columns: DataTableColumn<Row>[];
  rows: Row[];
  pageSize?: number;
  emptyMessage?: string;
};

export function PaginatedDataTable<Row extends Record<string, TableValue>>({
  title,
  description,
  columns,
  rows,
  pageSize = 25,
  emptyMessage,
}: PaginatedDataTableProps<Row>) {
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const [page, setPage] = useState(1);
  const currentPage = Math.min(page, pageCount);

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
            onChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

function Pager({
  page,
  pageCount,
  onChange,
}: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
}) {
  const pages = pageNumbers(page, pageCount);

  return (
    <nav className="flex items-center gap-1" aria-label="Pagination">
      <PagerButton
        label="Prev"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      />

      {pages.map((entry, i) =>
        entry === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-2 text-muted">
            &hellip;
          </span>
        ) : (
          <PagerButton
            key={entry}
            label={String(entry)}
            active={entry === page}
            onClick={() => onChange(entry)}
          />
        )
      )}

      <PagerButton
        label="Next"
        disabled={page >= pageCount}
        onClick={() => onChange(page + 1)}
      />
    </nav>
  );
}

function PagerButton({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      className={cn(
        "min-w-8 rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
        active
          ? "border-foreground/20 bg-surface-2 text-foreground"
          : "border-transparent text-muted hover:bg-surface-2",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
      )}
    >
      {label}
    </button>
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
