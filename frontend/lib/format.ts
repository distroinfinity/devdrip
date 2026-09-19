// 2-decimal dollar format with tabular-nums-friendly rendering.
// values are USDC floats from the backend.
export function formatUsd(amount: number): string {
  const sign = amount < 0 ? "-" : ""
  const abs = Math.abs(amount)
  return `${sign}$${abs.toFixed(2)}`
}

// compact dollars for tight axes: $1.2k, $12, $0.50
export function formatUsdCompact(amount: number): string {
  const abs = Math.abs(amount)
  const sign = amount < 0 ? "-" : ""
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}k`
  if (abs >= 100) return `${sign}$${abs.toFixed(0)}`
  if (abs >= 1) return `${sign}$${abs.toFixed(2)}`
  return `${sign}$${abs.toFixed(2)}`
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n))
}

// "Jan 26" — axis tick format
export function formatDayShort(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })
}

export function formatTimeHM(d: Date = new Date()): string {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false })
}

// "18s", "1.4s", "12m 03s" — used in impression duration cells where we want
// to convey rough magnitude without flooding the column with milliseconds.
export function formatDurationMs(ms: number): string {
  if (ms < 1_000) return `${ms}ms`
  const s = ms / 1_000
  if (s < 60) return s < 10 ? `${s.toFixed(1)}s` : `${Math.round(s)}s`
  const m = Math.floor(s / 60)
  const rem = Math.round(s - m * 60)
  return `${m}m ${rem.toString().padStart(2, "0")}s`
}

// "Apr 24, 14:32" — table row timestamps
export function formatDateTimeShort(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

// "$0.0418" — earned amounts can be sub-cent; default formatUsd rounds them
// to "$0.04" which loses precision in the impression history view.
export function formatUsdPrecise(amount: number, decimals = 4): string {
  const sign = amount < 0 ? "-" : ""
  return `${sign}$${Math.abs(amount).toFixed(decimals)}`
}
