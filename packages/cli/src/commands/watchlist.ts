import { Command } from "commander"
import type { AssetClass } from "@distrotv/shared"
import { reportError } from "../lib/api-client.js"
import { getMyWatchlists, putMyWatchlists } from "../lib/watchlists-client.js"

const SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/

const KNOWN_CRYPTO = new Set(["BTC", "ETH", "SOL", "ADA", "XRP", "DOGE", "MATIC", "AVAX"])

function inferAssetClass(symbol: string): AssetClass {
  return KNOWN_CRYPTO.has(symbol) ? "crypto" : "equity"
}

async function runList(): Promise<void> {
  const lists = await getMyWatchlists()
  if (lists.length === 0) {
    process.stdout.write("(no watchlists yet — run `distro init` to seed defaults)\n")
    return
  }
  for (const l of lists) {
    process.stdout.write(`${l.name} (${l.tickers.length})\n`)
    for (const t of l.tickers) {
      process.stdout.write(`  ${t.symbol.padEnd(8)} ${t.assetClass}\n`)
    }
  }
}

async function runAdd(symbolRaw: string): Promise<void> {
  const symbol = symbolRaw.toUpperCase()
  if (!SYMBOL_RE.test(symbol)) {
    process.stderr.write(`invalid symbol: ${symbolRaw}\n`)
    process.exit(2)
  }
  const lists = await getMyWatchlists()
  const primary = lists[0]
  if (!primary) {
    process.stderr.write("no watchlists exist — run `distro init` first\n")
    process.exit(2)
  }
  if (primary.tickers.some((t) => t.symbol === symbol)) {
    process.stdout.write(`${symbol} already in ${primary.name}\n`)
    return
  }
  const next = [
    {
      name: primary.name,
      tickers: [
        ...primary.tickers.map((t) => ({ symbol: t.symbol, assetClass: t.assetClass })),
        { symbol, assetClass: inferAssetClass(symbol) },
      ],
    },
    ...lists.slice(1).map((l) => ({
      name: l.name,
      tickers: l.tickers.map((t) => ({ symbol: t.symbol, assetClass: t.assetClass })),
    })),
  ]
  await putMyWatchlists(next)
  process.stdout.write(`added ${symbol} to ${primary.name}\n`)
}

async function runRm(symbolRaw: string): Promise<void> {
  const symbol = symbolRaw.toUpperCase()
  const lists = await getMyWatchlists()
  const primary = lists[0]
  if (!primary) {
    process.stderr.write("no watchlists exist\n")
    process.exit(2)
  }
  if (!primary.tickers.some((t) => t.symbol === symbol)) {
    process.stdout.write(`${symbol} not in ${primary.name}\n`)
    return
  }
  const remaining = primary.tickers.filter((t) => t.symbol !== symbol)
  if (remaining.length === 0) {
    process.stderr.write("cannot remove last ticker — at least 1 must remain\n")
    process.exit(2)
  }
  const next = [
    {
      name: primary.name,
      tickers: remaining.map((t) => ({ symbol: t.symbol, assetClass: t.assetClass })),
    },
    ...lists.slice(1).map((l) => ({
      name: l.name,
      tickers: l.tickers.map((t) => ({ symbol: t.symbol, assetClass: t.assetClass })),
    })),
  ]
  await putMyWatchlists(next)
  process.stdout.write(`removed ${symbol} from ${primary.name}\n`)
}

export const watchlistCmd = new Command("watchlist").description("manage watchlists")

watchlistCmd
  .command("list")
  .description("list all watchlists and their tickers")
  .action(async () => {
    try {
      await runList()
    } catch (err) {
      reportError(err)
    }
  })

watchlistCmd
  .command("add <symbol>")
  .description("add a ticker to your primary watchlist")
  .action(async (symbol: string) => {
    try {
      await runAdd(symbol)
    } catch (err) {
      reportError(err)
    }
  })

watchlistCmd
  .command("rm <symbol>")
  .description("remove a ticker from your primary watchlist")
  .action(async (symbol: string) => {
    try {
      await runRm(symbol)
    } catch (err) {
      reportError(err)
    }
  })
