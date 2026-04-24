import { chmodSync, mkdirSync, renameSync } from "node:fs"
import { join } from "node:path"
import Database, { type Statement } from "better-sqlite3"
import { REVENUE_SHARE_DEVELOPER } from "@devdrip/shared"
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

export interface Ledger {
  record(i: LocalImpression): void
  listUnsynced(limit: number): LocalImpression[]
  markSynced(ids: string[], at: number): void
  unsyncedCount(): number
  // Optimistic running total of developer-share USDC earned today (local day
  // per tzOffsetMinutes). Sums (cpm_rate / 1000) * REVENUE_SHARE_DEVELOPER over
  // completed impressions whose started_at falls in today's local window. Used
  // by the S3-05 earnings toast; backend remains authoritative at sync time.
  sumTodayOptimistic(tzOffsetMinutes: number, now?: number): number
  close(): void
}

const SCHEMA_VERSION = 1

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
    close() {
      db.close()
    },
  }
}
