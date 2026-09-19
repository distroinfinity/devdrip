import { ValidationError } from "../errors/index.js"
import { requireBody } from "./common.js"
import type { AlertScope } from "@distrotv/shared"
import { ALERT_LIMITS } from "../services/alert.service.js"

const SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/
const SCOPES: AlertScope[] = ["global", "per_ticker"]

export interface PutAlertsInput {
  alerts: { scope: AlertScope; symbol: string | null; thresholdPct: number }[]
}

export function validatePutAlerts(body: unknown): PutAlertsInput {
  const b = requireBody(body)
  const arr = b["alerts"]
  if (!Array.isArray(arr)) throw new ValidationError("invalid_alerts")

  const out: PutAlertsInput["alerts"] = []
  let globalCount = 0
  const seenSymbols = new Set<string>()

  for (const item of arr) {
    if (typeof item !== "object" || item === null) throw new ValidationError("invalid_alert_item")
    const o = item as Record<string, unknown>
    const scope = o["scope"]
    if (typeof scope !== "string" || !SCOPES.includes(scope as AlertScope)) {
      throw new ValidationError("invalid_alert_scope")
    }
    const threshold = o["thresholdPct"]
    if (
      typeof threshold !== "number" ||
      !Number.isFinite(threshold) ||
      threshold < ALERT_LIMITS.MIN_THRESHOLD ||
      threshold > ALERT_LIMITS.MAX_THRESHOLD
    ) {
      throw new ValidationError("invalid_threshold")
    }

    if (scope === "global") {
      const sym = o["symbol"]
      if (sym !== null && sym !== undefined)
        throw new ValidationError("global_alert_symbol_must_be_null")
      globalCount++
      if (globalCount > 1) throw new ValidationError("at_most_one_global_alert")
      out.push({ scope: "global", symbol: null, thresholdPct: threshold })
    } else {
      const sym = o["symbol"]
      if (typeof sym !== "string") throw new ValidationError("invalid_symbol")
      const upper = sym.toUpperCase()
      if (!SYMBOL_RE.test(upper)) throw new ValidationError("invalid_symbol")
      if (seenSymbols.has(upper)) throw new ValidationError("duplicate_alert_symbol")
      seenSymbols.add(upper)
      out.push({ scope: "per_ticker", symbol: upper, thresholdPct: threshold })
    }
  }

  // cap per_ticker independently — using `out.length > 26` would let 26 per_ticker
  // entries with no global slip through (only the service-side throw would catch it,
  // surfacing as 500 instead of a structured 400).
  const perTickerCount = out.filter((a) => a.scope === "per_ticker").length
  if (perTickerCount > ALERT_LIMITS.PER_TICKER_OVERRIDES_MAX) {
    throw new ValidationError("too_many_alerts")
  }
  return { alerts: out }
}
