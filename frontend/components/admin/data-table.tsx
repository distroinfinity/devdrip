import type { ReactNode } from "react"

export interface ColumnDef<T> {
  key: string
  header: string
  width?: string
  render: (row: T) => ReactNode
  align?: "left" | "right" | "center"
}

interface Props<T> {
  rows: T[]
  columns: ColumnDef<T>[]
  emptyState?: ReactNode
  rowKey: (row: T) => string
  onRowClick?: (row: T) => void
}

export function DataTable<T>({ rows, columns, emptyState, rowKey, onRowClick }: Props<T>) {
  if (rows.length === 0 && emptyState) return <>{emptyState}</>

  const gridTemplate = columns.map((c) => c.width ?? "auto").join(" ")

  return (
    <div className="font-[var(--font-data)] text-[11px] tabular-nums">
      <div
        className="grid border-b border-[var(--rule-default)] py-1.5 px-3 text-[9px] tracking-[0.1em] uppercase text-[var(--ink-tertiary)] font-[var(--font-display)] font-bold"
        style={{ gridTemplateColumns: gridTemplate, gap: "12px" }}
      >
        {columns.map((c) => (
          <div key={c.key} style={{ textAlign: c.align ?? "left" }}>
            {c.header}
          </div>
        ))}
      </div>
      {rows.map((row) => (
        <div
          key={rowKey(row)}
          className={`grid py-1.5 px-3 border-b border-[var(--rule-2)] ${
            onRowClick ? "cursor-pointer hover:bg-[var(--bg-surface-hover)]" : ""
          }`}
          style={{ gridTemplateColumns: gridTemplate, gap: "12px" }}
          onClick={onRowClick ? () => onRowClick(row) : undefined}
        >
          {columns.map((c) => (
            <div
              key={c.key}
              style={{
                textAlign: c.align ?? "left",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {c.render(row)}
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
