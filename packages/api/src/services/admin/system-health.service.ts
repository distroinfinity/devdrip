import { sql } from "drizzle-orm"
import { getDb } from "../../db/index.js"
import { newsSources } from "../../db/schema/news_sources.js"

export interface SystemHealthDto {
  newsSources: Array<{
    id: string
    key: string
    kind: string
    enabled: boolean
    healthy: boolean
    lastFetchedAt: string | null
    lastError: string | null
    fetchIntervalMin: number
    status: "green" | "amber" | "red"
  }>
  tickerProviders: Array<{
    provider: "finnhub" | "coingecko"
    lastQuoteAt: string | null
    enabledSymbolCount: number
    status: "green" | "amber" | "red"
  }>
}

function sourceStatus(
  healthy: boolean,
  enabled: boolean,
  lastFetchedAt: Date | null,
  intervalMin: number
): "green" | "amber" | "red" {
  if (!enabled) return "red"
  if (!healthy) return "red"
  if (!lastFetchedAt) return "amber"
  const ageMs = Date.now() - lastFetchedAt.getTime()
  if (ageMs > intervalMin * 60 * 1000 * 2) return "amber"
  return "green"
}

export async function getSystemHealth(): Promise<SystemHealthDto> {
  const db = getDb()
  const sources = await db.select().from(newsSources)
  const newsSourcesDto = sources.map((s) => ({
    id: s.id,
    key: s.key,
    kind: s.kind,
    enabled: s.enabled,
    healthy: s.healthy,
    lastFetchedAt: s.lastFetchedAt?.toISOString() ?? null,
    lastError: s.lastError,
    fetchIntervalMin: s.fetchIntervalMin,
    status: sourceStatus(s.healthy, s.enabled, s.lastFetchedAt ?? null, s.fetchIntervalMin),
  }))

  // ticker_quotes uses fetched_at (not updated_at); asset_class maps to provider
  const lastQuotes = await db.execute(sql`
    SELECT
      CASE WHEN asset_class = 'crypto' THEN 'coingecko' ELSE 'finnhub' END AS provider,
      MAX(fetched_at) AS last_quote_at
    FROM ticker_quotes
    GROUP BY provider
  `)
  const enabledByProvider = await db.execute(sql`
    SELECT provider, COUNT(*) FILTER (WHERE enabled) AS enabled_count
    FROM ticker_symbol_map
    GROUP BY provider
  `)

  // Neon HTTP driver returns { rows: [...] }; pg driver returns the array directly
  const lastQuoteRows =
    (lastQuotes as unknown as { rows?: unknown[] }).rows ?? (lastQuotes as unknown as unknown[])
  const enabledRows =
    (enabledByProvider as unknown as { rows?: unknown[] }).rows ??
    (enabledByProvider as unknown as unknown[])

  const lastQuoteMap = new Map<string, Date>()
  for (const r of lastQuoteRows as Array<{ provider: string; last_quote_at: string | null }>) {
    if (r.last_quote_at) lastQuoteMap.set(r.provider, new Date(r.last_quote_at))
  }
  const enabledMap = new Map<string, number>()
  for (const r of enabledRows as Array<{ provider: string; enabled_count: string | number }>) {
    enabledMap.set(r.provider, Number(r.enabled_count))
  }

  const tickerProviders: SystemHealthDto["tickerProviders"] = (
    ["finnhub", "coingecko"] as const
  ).map((p) => {
    const last = lastQuoteMap.get(p) ?? null
    const ageMs = last ? Date.now() - last.getTime() : null
    let status: "green" | "amber" | "red" = "green"
    if (!last) status = "red"
    else if (ageMs !== null && ageMs > 10 * 60 * 1000) status = "amber"
    return {
      provider: p,
      lastQuoteAt: last?.toISOString() ?? null,
      enabledSymbolCount: enabledMap.get(p) ?? 0,
      status,
    }
  })

  return { newsSources: newsSourcesDto, tickerProviders }
}
