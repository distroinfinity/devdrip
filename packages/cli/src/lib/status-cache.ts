import { randomBytes } from "node:crypto"
import { chmodSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { configDir } from "./config.js"

// cached copy of the last successful /me/earnings/summary response, so
// `distro status` can render today/week/month/streak when the backend is
// unreachable. marked stale after ~24h — older than that is worse than showing
// "—" because it misleads about recent earnings.
const MAX_CACHE_AGE_MS = 24 * 60 * 60 * 1000
const CACHE_VERSION = 1

export interface CachedEarningsSummary {
  balance: number
  today: number
  week: number
  month: number
  allTime: number
  streakDays: number
  totalImpressions: number
  totalClicks: number
  topCategories: { category: string; amountUsdc: number }[]
}

interface CacheFile {
  version: 1
  fetchedAt: number
  summary: CachedEarningsSummary
}

export interface ReadStatusCache {
  summary: CachedEarningsSummary
  fetchedAt: number
  ageMs: number
}

function cachePath(): string {
  return join(configDir(), "status.cache.json")
}

export function readStatusCache(now: number = Date.now()): ReadStatusCache | null {
  try {
    const raw = readFileSync(cachePath(), "utf8")
    const parsed = JSON.parse(raw) as CacheFile
    if (parsed.version !== CACHE_VERSION) return null
    const ageMs = now - parsed.fetchedAt
    if (ageMs > MAX_CACHE_AGE_MS || ageMs < 0) return null
    return { summary: parsed.summary, fetchedAt: parsed.fetchedAt, ageMs }
  } catch {
    return null
  }
}

export function writeStatusCache(summary: CachedEarningsSummary, now: number = Date.now()): void {
  const dir = configDir()
  const target = cachePath()
  const tmp = join(dir, `.status.cache.${randomBytes(6).toString("hex")}.tmp`)
  const payload: CacheFile = { version: CACHE_VERSION, fetchedAt: now, summary }
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  writeFileSync(tmp, JSON.stringify(payload), { mode: 0o600 })
  renameSync(tmp, target)
  try {
    chmodSync(target, 0o600)
  } catch {
    /* ignore */
  }
}
