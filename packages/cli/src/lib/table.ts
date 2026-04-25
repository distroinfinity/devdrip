import Table from "cli-table3"

export interface Column<T> {
  header: string
  get: (row: T) => string | number | null | undefined
}

export function printTable<T>(rows: T[], columns: Column<T>[]): void {
  if (rows.length === 0) {
    console.log("(no rows)")
    return
  }
  const table = new Table({
    head: columns.map((c) => c.header),
    style: { head: [], border: [] },
  })
  for (const row of rows) {
    table.push(columns.map((c) => formatCell(c.get(row))))
  }
  console.log(table.toString())
}

export function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2))
}

function formatCell(val: string | number | null | undefined): string {
  if (val === null || val === undefined) return "—"
  return String(val)
}

// short UUID for tables — full ID still available via --json
export function shortId(id: string): string {
  return id.slice(0, 8)
}

export function formatUsdc(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—"
  return `$${n.toFixed(4)}`
}

export function formatDate(s: string | Date | null | undefined): string {
  if (!s) return "—"
  const d = typeof s === "string" ? new Date(s) : s
  return d.toISOString().slice(0, 19).replace("T", " ")
}
