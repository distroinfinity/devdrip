import { apiFetchOrRefresh } from "./api"

export interface OverviewDto {
  counts: { users: number; slots7d: number; alerts7d: number }
  signupsLast7d: {
    byDay: Array<{ day: string; count: number }>
    recent: Array<{ id: string; email: string | null; createdAt: string }>
  }
  modeDistribution: Array<{ mode: string; count: number }>
  recentAlerts: Array<{
    id: string
    userId: string
    symbol: string
    changePct: number
    thresholdPct: number
    firedAt: string
  }>
}

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

export interface NewsSourceRow {
  id: string
  channelId: string
  key: string
  kind: string
  url: string
  halfLifeHours: number
  fetchIntervalMin: number
  healthy: boolean
  enabled: boolean
  lastFetchedAt: string | null
  lastError: string | null
  createdAt: string
}

export interface NewsSourceCreate {
  channelId: string
  key: string
  kind: string
  url: string
  halfLifeHours: number
  fetchIntervalMin: number
  enabled?: boolean
}

export interface TickerSymbolRow {
  symbol: string
  assetClass: "equity" | "crypto"
  provider: "finnhub" | "coingecko"
  providerId: string
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface TickerSymbolCreate {
  symbol: string
  assetClass: "equity" | "crypto"
  provider: "finnhub" | "coingecko"
  providerId: string
  enabled?: boolean
}

export interface UserListRow {
  id: string
  email: string | null
  createdAt: string
  mode: string | null
  lastActivity: string | null
  channelCount: number
  watchlistSize: number
  deviceCount: number
  alertsFired7d: number
}

export interface UserDrilldown {
  user: { id: string; email: string | null; createdAt: string }
  preferences: unknown
  devices: unknown[]
  channelSubscriptions: unknown[]
  watchlistTickers: unknown[]
  alerts: unknown[]
  recentAlertEvents: unknown[]
  recentImpressions: unknown[]
}

export interface MetricsDto {
  slotsByDay: Array<{ day: string; news: number; ticker: number; alert: number }>
  saveRateByDay: Array<{ day: string; rate: number }>
  modeDistribution: Array<{ mode: string; count: number }>
  newsCtrBySource: Array<{ source: string; impressions: number; opened: number; ctr: number }>
  alertsByDay: Array<{ day: string; count: number }>
}

export interface AuditEventDto {
  id: string
  firedAt: string
  userId: string
  email: string | null
  symbol: string
  changePct: number
  thresholdPct: number
  deviceId: string | null
}

export const adminApi = {
  overview: () => apiFetchOrRefresh<OverviewDto>("/admin/overview", "/"),
  systemHealth: () => apiFetchOrRefresh<SystemHealthDto>("/admin/system-health", "/"),
  newsSources: () => apiFetchOrRefresh<{ sources: NewsSourceRow[] }>("/admin/news-sources", "/"),
  createNewsSource: (body: NewsSourceCreate) =>
    apiFetchOrRefresh<NewsSourceRow>("/admin/news-sources", "/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateNewsSource: (id: string, body: Partial<NewsSourceCreate>) =>
    apiFetchOrRefresh<NewsSourceRow>(`/admin/news-sources/${id}`, "/", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteNewsSource: (id: string) =>
    apiFetchOrRefresh<unknown>(`/admin/news-sources/${id}`, "/", { method: "DELETE" }),
  tickerSymbols: () =>
    apiFetchOrRefresh<{ symbols: TickerSymbolRow[] }>("/admin/ticker-symbols", "/"),
  createTickerSymbol: (body: TickerSymbolCreate) =>
    apiFetchOrRefresh<TickerSymbolRow>("/admin/ticker-symbols", "/", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  updateTickerSymbol: (symbol: string, body: Partial<TickerSymbolCreate>) =>
    apiFetchOrRefresh<TickerSymbolRow>(`/admin/ticker-symbols/${symbol}`, "/", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  deleteTickerSymbol: (symbol: string) =>
    apiFetchOrRefresh<unknown>(`/admin/ticker-symbols/${symbol}`, "/", { method: "DELETE" }),
  users: (page: number, limit: number) =>
    apiFetchOrRefresh<{ users: UserListRow[]; total: number; page: number; limit: number }>(
      `/admin/users?page=${page}&limit=${limit}`,
      "/"
    ),
  user: (id: string) => apiFetchOrRefresh<UserDrilldown>(`/admin/users/${id}`, "/"),
  metrics: (days: number) => apiFetchOrRefresh<MetricsDto>(`/admin/metrics?days=${days}`, "/"),
  alertEvents: (limit: number, since?: string) =>
    apiFetchOrRefresh<{ events: AuditEventDto[] }>(
      `/admin/alert-events?limit=${limit}${since ? `&since=${encodeURIComponent(since)}` : ""}`,
      "/"
    ),
}
