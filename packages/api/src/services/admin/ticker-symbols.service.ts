import { eq, asc } from "drizzle-orm"
import { getDb } from "../../db/index.js"
import { tickerSymbolMap } from "../../db/schema/ticker_symbol_map.js"
import { invalidateSymbolMapCache } from "../ticker-fetchers/symbol-map.js"
import { ValidationError } from "../../errors/index.js"

export interface TickerSymbolInput {
  symbol: string
  assetClass: "equity" | "crypto"
  provider: "finnhub" | "coingecko"
  providerId: string
  enabled?: boolean
}

const SYMBOL_RE = /^[A-Z0-9.\-]{1,16}$/

function validate(input: Partial<TickerSymbolInput>): void {
  if (input.symbol !== undefined && !SYMBOL_RE.test(input.symbol))
    throw new ValidationError("invalid_symbol")
  if (input.assetClass !== undefined && !["equity", "crypto"].includes(input.assetClass))
    throw new ValidationError("invalid_asset_class")
  if (input.provider !== undefined && !["finnhub", "coingecko"].includes(input.provider))
    throw new ValidationError("invalid_provider")
  if (
    input.providerId !== undefined &&
    (input.providerId.length === 0 || input.providerId.length > 64)
  )
    throw new ValidationError("invalid_provider_id")
}

export async function listTickerSymbols() {
  const db = getDb()
  return db
    .select()
    .from(tickerSymbolMap)
    .orderBy(asc(tickerSymbolMap.assetClass), asc(tickerSymbolMap.symbol))
}

export async function createTickerSymbol(input: TickerSymbolInput) {
  validate(input)
  const db = getDb()
  const [row] = await db
    .insert(tickerSymbolMap)
    .values({
      symbol: input.symbol.toUpperCase(),
      assetClass: input.assetClass,
      provider: input.provider,
      providerId: input.providerId,
      enabled: input.enabled ?? true,
    })
    .returning()
  invalidateSymbolMapCache()
  return row
}

export async function updateTickerSymbol(symbol: string, patch: Partial<TickerSymbolInput>) {
  validate(patch)
  const db = getDb()
  const [row] = await db
    .update(tickerSymbolMap)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(tickerSymbolMap.symbol, symbol.toUpperCase()))
    .returning()
  invalidateSymbolMapCache()
  return row
}

export async function deleteTickerSymbol(symbol: string) {
  const db = getDb()
  await db.delete(tickerSymbolMap).where(eq(tickerSymbolMap.symbol, symbol.toUpperCase()))
  invalidateSymbolMapCache()
}
