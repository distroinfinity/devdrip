# Local Impression Ledger

Ground truth for slot impressions. The daemon records every news impression locally before the backend sees them, and `distro sync` batches unsynced rows to `POST /ingest` when the network is reachable.

## Why local

- **Latency** — hooks must vanish the slot in under 200ms. Writing to SQLite is a few microseconds; a backend round-trip is tens of milliseconds minimum.
- **Never-block hooks** — the Claude Code hook contract requires `exit 0`. Network failures or slow backends can't be allowed to stall the hook path.
- **Transient backend gaps** — Railway redeploys, Neon failovers, and wifi wobbles are routine during hour-long Claude sessions. A local buffer absorbs them; impressions sync whenever the backend comes back.
- **User-verifiable history** — `distro status --local` lets the dev audit what was shown and when, independent of server state.

## Storage

- Path: `~/.distro/ledger.db` (was `~/.devdrip/ledger.db` pre-pivot)
- Dir mode: `0700`, file mode: `0600`. WAL sidecars (`ledger.db-wal`, `ledger.db-shm`) also chmod'd to `0600` after the first write, since they carry the same rows between checkpoints.
- SQLite via `better-sqlite3`, WAL mode (`PRAGMA journal_mode=WAL; synchronous=NORMAL`)
- `PRAGMA busy_timeout = 5000` — allows concurrent writes from the daemon and `distro sync --force` without `SQLITE_BUSY` errors.
- Schema version tracked in `PRAGMA user_version` (current: **v2**)
- `distro status --local` is strictly read-only: if `ledger.db` doesn't exist it prints `unsynced: 0` without creating it. The file is only ever created by the daemon on first impression write.

## Schema (current)

```sql
-- news slot impressions
CREATE TABLE news_impressions_pending (
  id          TEXT PRIMARY KEY,  -- crypto.randomUUID()
  news_id     TEXT NOT NULL,     -- namespaced: "hn:38291043"
  source      TEXT NOT NULL,     -- "hn" | "tc" | "reuters" | ...
  device_id   TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  result      TEXT NOT NULL,     -- ImpressionResult: completed|skipped|expired|interrupted
  opened_url  INTEGER NOT NULL,  -- 0 or 1
  saved       INTEGER NOT NULL,  -- 0 or 1
  created_at  INTEGER NOT NULL,  -- epoch ms, client clock
  synced_at   INTEGER            -- epoch ms; NULL = pending; -1 = tombstone (terminal error)
);
CREATE INDEX idx_news_unsynced
  ON news_impressions_pending (synced_at) WHERE synced_at IS NULL;

-- reading list items (saved articles)
CREATE TABLE reading_pending (
  id          TEXT PRIMARY KEY,
  news_id     TEXT NOT NULL,
  source      TEXT NOT NULL,
  headline    TEXT NOT NULL,
  url         TEXT NOT NULL,
  score       INTEGER NOT NULL,
  saved_at    INTEGER NOT NULL,  -- epoch ms
  synced_at   INTEGER
);
CREATE INDEX idx_reading_unsynced
  ON reading_pending (synced_at) WHERE synced_at IS NULL;
```

`synced_at = -1` is the tombstone convention for terminal errors. Tombstoned rows are excluded by `IS NULL` queries and never retried.

Client-generated UUIDs serve as the idempotency key: the backend dedupes on replay, so a mid-sync crash or retry can't double-count.

## Module API

`packages/cli/src/lib/ledger.ts`:

```ts
openLedger(): Ledger
interface Ledger {
  // news impressions
  recordNewsImpression(i: LocalNewsImpression): void
  listUnsyncedNewsImpressions(limit: number): LocalNewsImpression[]
  markNewsImpressionsSync(ids: string[], at: number): void
  markNewsImpressionsTerminal(ids: string[]): void
  unsyncedNewsImpressionCount(): number

  // reading list
  recordReadingPending(item: ReadingPendingItem): void
  listUnsyncedReading(limit: number): ReadingPendingItem[]
  markReadingSynced(ids: string[], at: number): void
  unsyncedReadingCount(): number

  close(): void
}
```

`recordNewsImpression()` uses `INSERT OR IGNORE` on the primary key, so replay-safe retries are free.

`markNewsImpressionsSync()` chunks at 500 ids per UPDATE inside a single transaction, staying well under SQLite's default `SQLITE_LIMIT_VARIABLE_NUMBER` (999). Large post-offline sync batches won't throw.

## Corruption recovery

If the DB file is unreadable on open (bad header, partial write from a killed process), the module rotates it to `ledger.db.corrupt.<ts>` and creates a fresh database. A warning goes to stderr. The user keeps working; the only loss is the unsynced buffer. Corrupted files are kept for post-mortem, not deleted.

## Sync semantics

The sync loop (`packages/cli/src/lib/daemon/sync.ts`) runs on a 5-minute timer inside the daemon and can be triggered manually via `distro sync --force`. One cycle:

```ts
const newsImpressions = ledger.listUnsyncedNewsImpressions(250)
const result = await apiClient.postIngest({ newsImpressions })
// per-item: terminal errors → markNewsImpressionsTerminal
//           ok              → markNewsImpressionsSync
```

Each cycle pulls up to 250 news impressions.

## Out of scope for MVP

- Retention / compaction — at 100 devs × 60 impressions/day × ~250B/row the file grows ~15KB/user/day. A year's data fits in 6MB. Compaction is not worth the code.
- Encryption at rest — 0600 perms are enough for this scale.
- Multi-writer coordination — daemon is a per-user singleton; WAL would serialize in a pinch but we don't intentionally run two writers.
