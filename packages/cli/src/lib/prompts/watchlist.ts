import { multiselect, text, isCancel, cancel } from "@clack/prompts"
import type { AssetClass } from "@distrotv/shared"

const SEED: { symbol: string; assetClass: AssetClass }[] = [
  { symbol: "AAPL", assetClass: "equity" },
  { symbol: "MSFT", assetClass: "equity" },
  { symbol: "NVDA", assetClass: "equity" },
  { symbol: "BTC", assetClass: "crypto" },
  { symbol: "ETH", assetClass: "crypto" },
]

const SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/

const KNOWN_CRYPTO = new Set(["BTC", "ETH", "SOL", "ADA", "XRP", "DOGE", "MATIC", "AVAX"])

function inferAssetClass(symbol: string): AssetClass {
  return KNOWN_CRYPTO.has(symbol.toUpperCase()) ? "crypto" : "equity"
}

export async function pickWatchlistTickers(): Promise<
  { symbol: string; assetClass: AssetClass }[]
> {
  const initial = SEED.map((t) => t.symbol)
  const selected = await multiselect<string>({
    message: "pick the seed tickers for your default watchlist (you can change later)",
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
    for (const part of extra.split(",")) {
      const sym = part.trim().toUpperCase()
      if (!SYMBOL_RE.test(sym)) continue
      if (out.some((t) => t.symbol === sym)) continue
      out.push({ symbol: sym, assetClass: inferAssetClass(sym) })
    }
  }
  return out
}
