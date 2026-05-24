import { multiselect, text, isCancel, cancel, log, spinner } from "@clack/prompts"
import type { AssetClass } from "@distrotv/shared"

const SEED: { symbol: string; assetClass: AssetClass }[] = [
  { symbol: "AAPL", assetClass: "equity" },
  { symbol: "MSFT", assetClass: "equity" },
  { symbol: "NVDA", assetClass: "equity" },
  { symbol: "BTC", assetClass: "crypto" },
  { symbol: "TSLA", assetClass: "equity" },
]

const SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/

const KNOWN_CRYPTO = new Set(["BTC", "ETH", "SOL", "ADA", "XRP", "DOGE", "MATIC", "AVAX"])

function inferAssetClass(symbol: string): AssetClass {
  return KNOWN_CRYPTO.has(symbol.toUpperCase()) ? "crypto" : "equity"
}

// existence check against yahoo. returns true (exists), false (confirmed
// unknown), or null (couldn't check — network/rate-limit, so keep gracefully).
async function tickerExists(symbol: string, assetClass: AssetClass): Promise<boolean | null> {
  const ySym = assetClass === "crypto" ? `${symbol}-USD` : symbol
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 4000)
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ySym)}?range=1d&interval=1d`,
      { headers: { "user-agent": "Mozilla/5.0" }, signal: ctrl.signal }
    )
    if (res.status === 404) return false
    if (!res.ok) return null
    const json = (await res.json()) as {
      chart?: { result?: Array<{ meta?: { regularMarketPrice?: number } }> }
    }
    return typeof json.chart?.result?.[0]?.meta?.regularMarketPrice === "number"
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

export async function pickWatchlistTickers(): Promise<
  { symbol: string; assetClass: AssetClass }[]
> {
  const initial = SEED.map((t) => t.symbol)
  const selected = await multiselect<string>({
    message:
      "pick the seed tickers for your default watchlist  (space to toggle · enter to confirm)",
    options: SEED.map((t) => ({
      value: t.symbol,
      label: `${t.symbol}  (${t.assetClass})`,
    })),
    initialValues: initial,
    required: false,
  })
  if (isCancel(selected)) {
    cancel("cancelled")
    process.exit(0)
  }

  const extra = await text({
    message: "any other tickers? comma-separated (or leave blank to skip)",
    placeholder: "e.g. SOL, GOOGL, TSLA",
  })
  if (isCancel(extra)) {
    cancel("cancelled")
    process.exit(0)
  }

  const selectedSet = new Set(selected as string[])
  const out: { symbol: string; assetClass: AssetClass }[] = []
  for (const s of SEED) if (selectedSet.has(s.symbol)) out.push(s)

  if (typeof extra === "string" && extra.trim().length > 0) {
    const badFormat: string[] = []
    const candidates: { symbol: string; assetClass: AssetClass }[] = []
    for (const part of extra.split(",")) {
      const sym = part.trim().toUpperCase()
      if (sym.length === 0) continue
      if (!SYMBOL_RE.test(sym)) {
        badFormat.push(sym)
        continue
      }
      if (out.some((t) => t.symbol === sym) || candidates.some((t) => t.symbol === sym)) continue
      candidates.push({ symbol: sym, assetClass: inferAssetClass(sym) })
    }
    if (badFormat.length > 0) log.warn(`skipped (not a valid symbol): ${badFormat.join(", ")}`)

    // validate the manual entries exist before saving — never throw; an
    // unreachable check keeps the ticker rather than blocking onboarding.
    const unknown: string[] = []
    if (candidates.length > 0) {
      const s = spinner()
      s.start("checking tickers…")
      const checks = await Promise.all(candidates.map((c) => tickerExists(c.symbol, c.assetClass)))
      s.stop("checked tickers")
      candidates.forEach((c, i) => {
        if (checks[i] === false) unknown.push(c.symbol)
        else out.push(c)
      })
      if (unknown.length > 0) log.warn(`skipped (no market data found): ${unknown.join(", ")}`)
    }
  }
  return out
}
