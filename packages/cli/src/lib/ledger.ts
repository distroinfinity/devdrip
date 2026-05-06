import { chmodSync, mkdirSync, renameSync } from "node:fs"
import { join } from "node:path"
import Database, { type Statement } from "better-sqlite3"
import { REVENUE_SHARE_DEVELOPER } from "@distrotv/shared"
import { configDir } from "./config.js"

export type ImpressionResult = "completed" | "skipped" | "expired" | "interrupted"

export interface LocalImpression {
  id: string
  adId: string
  campaignId: string
  surface: string
  source: string
  deliveryToken: string
  startedAt: number
  durationMs: number
  result: ImpressionResult
  deviceId: string
  cpmRate?: number | null
}

export interface LocalClick {
  id: string
  deliveryToken: string
  createdAt: number
}

export interface ReadingPending {
  id: string
  newsId: string
  source: string
  headline: string
  url: string
  score: number
  savedAt: number
}

export interface LocalNewsImpression {
  id: string
  newsId: string
  source: string
  deviceId: string
  durationMs: number
  result: ImpressionResult
  openedUrl: boolean
  saved: boolean
  createdAt: number
}

export interface Ledger {
  record(i: LocalImpression): void
  listUnsynced(limit: number): LocalImpression[]
  /** Marks successful sync. Pass epoch-ms `at`. Do NOT pass -1 — that's the tombstone sentinel; use markImpressionsTerminal instead. */
  markSynced(ids: string[], at: number): void
  markImpressionsTerminal(ids: string[]): void
  unsyncedCount(): number
  // Optimistic running total of developer-share USDC earned today (local day
  // per tzOffsetMinutes). Sums (cpm_rate / 1000) * REVENUE_SHARE_DEVELOPER over
  // completed impressions whose started_at falls in today's local window. Used
  // by the S3-05 earnings toast; backend remains authoritative at sync time.
  sumTodayOptimistic(tzOffsetMinutes: number, now?: number): number
  // count of today's UTC-day impressions for a given campaignId (any
  // `result`). used by the daemon to enforce per-campaign daily caps locally,
  // as a client-side guard on top of the backend's authoritative Redis
  // counter. deliberately UTC (not local): the backend keys Redis on
  // `utcDate()` in packages/api/src/lib/frequency.ts, so both sides must share
  // the same day boundary — otherwise users east or west of UTC disagree
  // around midnight and either over-serve or over-suppress cached ads.
  countImpressionsByCampaignOnUtcDay(campaignId: string, now?: number): number

  recordClick(c: LocalClick): void
  listUnsyncedClicks(limit: number): LocalClick[]
  /** Marks successful click sync. Pass epoch-ms `at`. Do NOT pass -1 — use markClicksTerminal. */
  markClicksSynced(ids: string[], at: number): void
  markClicksTerminal(ids: string[]): void
  unsyncedClickCount(): number

  recordReadingPending(item: ReadingPending): void
  listPendingReadingItems(limit: number): ReadingPending[]
  markReadingItemsSynced(ids: string[], at: number): void

  recordNewsImpression(item: LocalNewsImpression): void
  listUnsyncedNewsImpressions(limit: number): LocalNewsImpression[]
  markNewsImpressionsSynced(ids: string[], at: number): void

  close(): void
}

const SCHEMA_VERSION = 4

export function ledgerPath(): string {
  return join(configDir(), "ledger.db")
}

interface Row {
  id: string
  ad_id: string
  campaign_id: string
  surface: string
  source: string
  delivery_token: string
  started_at: number
  duration_ms: number
  result: string
  device_id: string
  cpm_rate: number | null
  synced_at: number | null
}

// returns the [start, end) epoch-ms window for the user's local day containing
// `nowMs`. matches the `localDayKey` convention in orchestrator.ts: tz offset
// is minutes east of UTC (IST=+330), and the day boundary is 00:00 local.
function localDayBounds(nowMs: number, tzOffsetMinutes: number): { start: number; end: number } {
  const offsetMs = tzOffsetMinutes * 60_000
  const shifted = new Date(nowMs + offsetMs)
  const startShifted = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate()
  )
  const start = startShifted - offsetMs
  return { start, end: start + 86_400_000 }
}

// returns the [start, end) epoch-ms window for the UTC day containing `nowMs`.
// kept separate from `localDayBounds` on purpose: per-campaign caps must line
// up with the backend's UTC-day Redis key (packages/api/src/lib/frequency.ts),
// while user-facing earnings totals want the user's local day. two semantics,
// two helpers.
function utcDayBounds(nowMs: number): { start: number; end: number } {
  const d = new Date(nowMs)
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  return { start, end: start + 86_400_000 }
}

function rowToImpression(r: Row): LocalImpression {
  return {
    id: r.id,
    adId: r.ad_id,
    campaignId: r.campaign_id,
    surface: r.surface,
    source: r.source,
    deliveryToken: r.delivery_token,
    startedAt: r.started_at,
    durationMs: r.duration_ms,
    result: r.result as ImpressionResult,
    deviceId: r.device_id,
    cpmRate: r.cpm_rate,
  }
}

// touching user_version forces the header to parse — surfaces corruption now
// rather than on the first real query
function tryOpen(path: string): Database.Database {
  const db = new Database(path)
  try {
    db.pragma("user_version")
    return db
  } catch (err) {
    db.close()
    throw err
  }
}

function runMigrations(db: Database.Database): void {
  const v = db.pragma("user_version", { simple: true }) as number
  if (v >= SCHEMA_VERSION) return

  if (v < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS impressions (
        id             TEXT PRIMARY KEY,
        ad_id          TEXT NOT NULL,
        campaign_id    TEXT NOT NULL,
        surface        TEXT NOT NULL,
        source         TEXT NOT NULL,
        delivery_token TEXT NOT NULL,
        started_at     INTEGER NOT NULL,
        duration_ms    INTEGER NOT NULL,
        result         TEXT NOT NULL,
        device_id      TEXT NOT NULL,
        cpm_rate       REAL,
        synced_at      INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_impressions_unsynced
        ON impressions (synced_at) WHERE synced_at IS NULL;
    `)
  }
  if (v < 2) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS clicks (
        id             TEXT PRIMARY KEY,
        delivery_token TEXT NOT NULL,
        created_at     INTEGER NOT NULL,
        synced_at      INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_clicks_unsynced
        ON clicks (synced_at) WHERE synced_at IS NULL;
    `)
  }
  if (v < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS reading_pending (
        id          TEXT PRIMARY KEY,
        news_id     TEXT NOT NULL,
        source      TEXT NOT NULL,
        headline    TEXT NOT NULL,
        url         TEXT NOT NULL,
        score       INTEGER NOT NULL,
        saved_at    INTEGER NOT NULL,
        synced_at   INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_reading_pending_unsynced
        ON reading_pending (synced_at) WHERE synced_at IS NULL;
    `)
  }
  if (v < 4) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS news_impressions_pending (
        id           TEXT PRIMARY KEY,
        news_id      TEXT NOT NULL,
        source       TEXT NOT NULL,
        device_id    TEXT NOT NULL,
        duration_ms  INTEGER NOT NULL,
        result       TEXT NOT NULL,
        opened_url   INTEGER NOT NULL DEFAULT 0,
        saved        INTEGER NOT NULL DEFAULT 0,
        created_at   INTEGER NOT NULL,
        synced_at    INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_news_impressions_unsynced
        ON news_impressions_pending (synced_at) WHERE synced_at IS NULL;
    `)
  }
  db.pragma(`user_version = ${SCHEMA_VERSION}`)
}

export function openLedger(): Ledger {
  mkdirSync(configDir(), { recursive: true, mode: 0o700 })
  const path = ledgerPath()

  let db: Database.Database
  try {
    db = tryOpen(path)
  } catch (err) {
    const corrupt = `${path}.corrupt.${Date.now()}`
    try {
      renameSync(path, corrupt)
    } catch {
      // nothing to rotate — probably just the new-file case
    }
    console.warn(
      `warn: ledger at ${path} unreadable (${(err as Error).message}); rotated to ${corrupt}`
    )
    db = tryOpen(path)
  }

  db.pragma("journal_mode = WAL")
  db.pragma("synchronous = NORMAL")
  // prevents SQLITE_BUSY errors when the daemon and `distro sync --force` write concurrently
  db.pragma("busy_timeout = 5000")
  runMigrations(db)

  // chmod after WAL + the first write (migrations) so the sidecar files
  // (.db-wal, .db-shm) exist and get 0600 too — they contain the same
  // sensitive rows as the main DB between checkpoints.
  for (const suffix of ["", "-wal", "-shm"]) {
    try {
      chmodSync(path + suffix, 0o600)
    } catch {
      // non-fatal: file may not exist yet, or filesystem doesn't honor chmod
    }
  }

  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO impressions
      (id, ad_id, campaign_id, surface, source, delivery_token,
       started_at, duration_ms, result, device_id, cpm_rate, synced_at)
    VALUES
      (@id, @ad_id, @campaign_id, @surface, @source, @delivery_token,
       @started_at, @duration_ms, @result, @device_id, @cpm_rate, NULL)
  `)
  const selectUnsyncedStmt = db.prepare(`
    SELECT * FROM impressions WHERE synced_at IS NULL ORDER BY started_at ASC LIMIT ?
  `)
  const countUnsyncedStmt = db.prepare(`
    SELECT COUNT(*) AS n FROM impressions WHERE synced_at IS NULL
  `)
  const sumTodayStmt = db.prepare(`
    SELECT COALESCE(SUM(cpm_rate), 0) AS total_cpm
    FROM impressions
    WHERE result = 'completed'
      AND cpm_rate IS NOT NULL
      AND started_at >= ?
      AND started_at < ?
  `)
  const countByCampaignOnUtcDayStmt = db.prepare(`
    SELECT COUNT(*) AS n
    FROM impressions
    WHERE campaign_id = ?
      AND started_at >= ?
      AND started_at < ?
  `)

  // SQLite's default SQLITE_LIMIT_VARIABLE_NUMBER is 999. Chunk mark-synced
  // updates well under that ceiling so a large sync batch can't throw.
  const MARK_SYNCED_CHUNK = 500
  // statement cache keyed by placeholder count — reused across sync calls
  const markStmts = new Map<number, Statement>()
  function markSyncedStmt(count: number): Statement {
    let stmt = markStmts.get(count)
    if (!stmt) {
      const placeholders = new Array<string>(count).fill("?").join(",")
      stmt = db.prepare(`UPDATE impressions SET synced_at = ? WHERE id IN (${placeholders})`)
      markStmts.set(count, stmt)
    }
    return stmt
  }

  const insertClickStmt = db.prepare(`
    INSERT OR IGNORE INTO clicks (id, delivery_token, created_at, synced_at)
    VALUES (@id, @delivery_token, @created_at, NULL)
  `)
  const selectUnsyncedClicksStmt = db.prepare(`
    SELECT id, delivery_token, created_at FROM clicks
    WHERE synced_at IS NULL ORDER BY created_at ASC LIMIT ?
  `)
  const countUnsyncedClicksStmt = db.prepare(`
    SELECT COUNT(*) AS n FROM clicks WHERE synced_at IS NULL
  `)
  const markClickStmts = new Map<number, Statement>()
  function markClickSyncedStmt(count: number): Statement {
    let stmt = markClickStmts.get(count)
    if (!stmt) {
      const placeholders = new Array<string>(count).fill("?").join(",")
      stmt = db.prepare(`UPDATE clicks SET synced_at = ? WHERE id IN (${placeholders})`)
      markClickStmts.set(count, stmt)
    }
    return stmt
  }

  const insertReadingStmt = db.prepare(`
    INSERT OR IGNORE INTO reading_pending
      (id, news_id, source, headline, url, score, saved_at, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `)
  const listReadingStmt = db.prepare(`
    SELECT id, news_id, source, headline, url, score, saved_at
    FROM reading_pending
    WHERE synced_at IS NULL
    ORDER BY saved_at ASC
    LIMIT ?
  `)
  const markReadingSyncedStmt = db.prepare(`
    UPDATE reading_pending SET synced_at = ?
    WHERE id IN (SELECT value FROM json_each(?))
  `)

  const insertNewsImpressionStmt = db.prepare(`
    INSERT OR IGNORE INTO news_impressions_pending
      (id, news_id, source, device_id, duration_ms, result, opened_url, saved, created_at, synced_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
  `)
  const listUnsyncedNewsImpressionsStmt = db.prepare(`
    SELECT id, news_id, source, device_id, duration_ms, result, opened_url, saved, created_at
    FROM news_impressions_pending
    WHERE synced_at IS NULL
    ORDER BY created_at ASC
    LIMIT ?
  `)
  const markNewsImpressionsSyncedStmt = db.prepare(`
    UPDATE news_impressions_pending SET synced_at = ?
    WHERE id IN (SELECT value FROM json_each(?))
  `)

  return {
    record(i) {
      insertStmt.run({
        id: i.id,
        ad_id: i.adId,
        campaign_id: i.campaignId,
        surface: i.surface,
        source: i.source,
        delivery_token: i.deliveryToken,
        started_at: i.startedAt,
        duration_ms: i.durationMs,
        result: i.result,
        device_id: i.deviceId,
        cpm_rate: i.cpmRate ?? null,
      })
    },
    listUnsynced(limit) {
      const rows = selectUnsyncedStmt.all(limit) as Row[]
      return rows.map(rowToImpression)
    },
    markSynced(ids, at) {
      if (ids.length === 0) return
      const apply = db.transaction((batch: string[]) => {
        for (let i = 0; i < batch.length; i += MARK_SYNCED_CHUNK) {
          const chunk = batch.slice(i, i + MARK_SYNCED_CHUNK)
          markSyncedStmt(chunk.length).run(at, ...chunk)
        }
      })
      apply(ids)
    },
    markImpressionsTerminal(ids) {
      // tombstone: synced_at = -1 means terminal error, stop retrying
      this.markSynced(ids, -1)
    },
    unsyncedCount() {
      const row = countUnsyncedStmt.get() as { n: number }
      return row.n
    },
    sumTodayOptimistic(tzOffsetMinutes, now) {
      const { start, end } = localDayBounds(now ?? Date.now(), tzOffsetMinutes)
      const row = sumTodayStmt.get(start, end) as { total_cpm: number }
      // earned per impression = (cpm / 1000) * developer_share. aggregating
      // after multiplication is equivalent to summing cpm first and dividing
      // once, which keeps the SQL trivial and avoids per-row arithmetic.
      return (row.total_cpm / 1000) * REVENUE_SHARE_DEVELOPER
    },
    countImpressionsByCampaignOnUtcDay(campaignId, now) {
      const { start, end } = utcDayBounds(now ?? Date.now())
      const row = countByCampaignOnUtcDayStmt.get(campaignId, start, end) as { n: number }
      return row.n
    },
    recordClick(c) {
      insertClickStmt.run({
        id: c.id,
        delivery_token: c.deliveryToken,
        created_at: c.createdAt,
      })
    },
    listUnsyncedClicks(limit) {
      const rows = selectUnsyncedClicksStmt.all(limit) as Array<{
        id: string
        delivery_token: string
        created_at: number
      }>
      return rows.map((r) => ({
        id: r.id,
        deliveryToken: r.delivery_token,
        createdAt: r.created_at,
      }))
    },
    markClicksSynced(ids, at) {
      if (ids.length === 0) return
      const apply = db.transaction((batch: string[]) => {
        for (let i = 0; i < batch.length; i += MARK_SYNCED_CHUNK) {
          const chunk = batch.slice(i, i + MARK_SYNCED_CHUNK)
          markClickSyncedStmt(chunk.length).run(at, ...chunk)
        }
      })
      apply(ids)
    },
    markClicksTerminal(ids) {
      // tombstone: synced_at = -1 means terminal error, stop retrying
      this.markClicksSynced(ids, -1)
    },
    unsyncedClickCount() {
      const row = countUnsyncedClicksStmt.get() as { n: number }
      return row.n
    },
    recordReadingPending(item) {
      insertReadingStmt.run(
        item.id,
        item.newsId,
        item.source,
        item.headline,
        item.url,
        item.score,
        item.savedAt
      )
    },
    listPendingReadingItems(limit) {
      const rows = listReadingStmt.all(limit) as Array<{
        id: string
        news_id: string
        source: string
        headline: string
        url: string
        score: number
        saved_at: number
      }>
      return rows.map((r) => ({
        id: r.id,
        newsId: r.news_id,
        source: r.source,
        headline: r.headline,
        url: r.url,
        score: r.score,
        savedAt: r.saved_at,
      }))
    },
    markReadingItemsSynced(ids, at) {
      if (ids.length === 0) return
      markReadingSyncedStmt.run(at, JSON.stringify(ids))
    },
    recordNewsImpression(item) {
      insertNewsImpressionStmt.run(
        item.id,
        item.newsId,
        item.source,
        item.deviceId,
        item.durationMs,
        item.result,
        item.openedUrl ? 1 : 0,
        item.saved ? 1 : 0,
        item.createdAt
      )
    },
    listUnsyncedNewsImpressions(limit) {
      const rows = listUnsyncedNewsImpressionsStmt.all(limit) as Array<{
        id: string
        news_id: string
        source: string
        device_id: string
        duration_ms: number
        result: string
        opened_url: number
        saved: number
        created_at: number
      }>
      return rows.map((r) => ({
        id: r.id,
        newsId: r.news_id,
        source: r.source,
        deviceId: r.device_id,
        durationMs: r.duration_ms,
        result: r.result as ImpressionResult,
        openedUrl: r.opened_url !== 0,
        saved: r.saved !== 0,
        createdAt: r.created_at,
      }))
    },
    markNewsImpressionsSynced(ids, at) {
      if (ids.length === 0) return
      markNewsImpressionsSyncedStmt.run(at, JSON.stringify(ids))
    },
    close() {
      db.close()
    },
  }
}
