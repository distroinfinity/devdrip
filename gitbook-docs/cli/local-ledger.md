# Local Impression Ledger

Ground truth for earnings. The daemon records every impression and click locally before the backend sees them, and `distro sync` batches unsynced rows to `POST /ingest` when the network is reachable.

## Why local

- **Latency** — hooks must vanish the ad in under 200ms (see `packages/shared/src/constants/index.ts:VANISH_DEADLINE_MS`). Writing to SQLite is a few microseconds; a backend round-trip is tens of milliseconds minimum.
- **Never-block hooks** — the Claude Code hook contract requires `exit 0`. Network failures or slow backends can't be allowed to stall the hook path.
- **Transient backend gaps** — Railway redeploys, Neon failovers, and wifi wobbles are routine during hour-long Claude sessions. A local buffer absorbs them; impressions sync whenever the backend comes back.
- **User-verifiable earnings** — `distro status --local` lets the dev audit what was shown and when, independent of server state.

## Storage

- Path: `~/.distro/ledger.db` (was `~/.devdrip/ledger.db` pre-pivot)
- Dir mode: `0700`, file mode: `0600`. WAL sidecars (`ledger.db-wal`, `ledger.db-shm`) also chmod'd to `0600` after the first write, since they carry the same rows between checkpoints.
- SQLite via `better-sqlite3`, WAL mode (`PRAGMA journal_mode=WAL; synchronous=NORMAL`)
- `PRAGMA busy_timeout = 5000` — allows concurrent writes from the daemon and `distro sync --force` without `SQLITE_BUSY` errors.
- Schema version tracked in `PRAGMA user_version` (current: **v2**)
- `distro status --local` is strictly read-only: if `ledger.db` doesn't exist it prints `unsynced: 0` without creating it. The file is only ever created by the daemon on first impression write.

## Schema (v2)

```sql
CREATE TABLE impressions (
  id             TEXT PRIMARY KEY,  -- crypto.randomUUID(); also the backend idempotency key
  ad_id          TEXT NOT NULL,
  campaign_id    TEXT NOT NULL,
  surface        TEXT NOT NULL,     -- "terminal-tv" for MVP
  source         TEXT NOT NULL,     -- "direct" | "carbon" | ... (observability only)
  delivery_token TEXT NOT NULL,     -- JWT issued by GET /ads/batch; consumed by POST /ingest
  started_at     INTEGER NOT NULL,  -- epoch ms, client clock
  duration_ms    INTEGER NOT NULL,
  result         TEXT NOT NULL,     -- matches ImpressionResult: completed|skipped|expired|interrupted
  device_id      TEXT NOT NULL,
  cpm_rate       REAL,              -- cached for local earnings preview; backend recomputes
  synced_at      INTEGER            -- epoch ms; NULL = pending; -1 = tombstone (terminal error)
);
CREATE INDEX idx_impressions_unsynced
  ON impressions (synced_at) WHERE synced_at IS NULL;

-- v2: click tracking
CREATE TABLE clicks (
  id             TEXT PRIMARY KEY,  -- crypto.randomUUID()
  delivery_token TEXT NOT NULL,     -- the impression's delivery token (carries jti for server lookup)
  created_at     INTEGER NOT NULL,  -- epoch ms, client clock
  synced_at      INTEGER            -- epoch ms; NULL = pending; -1 = tombstone (terminal error)
);
CREATE INDEX idx_clicks_unsynced
  ON clicks (synced_at) WHERE synced_at IS NULL;
```

`synced_at = -1` is the tombstone convention for terminal errors. Tombstoned rows are excluded by `IS NULL` queries and never retried.

Client-generated UUIDs serve as the idempotency key: the backend dedupes on replay, so a mid-sync crash or retry can't double-count.

## Module API

`packages/cli/src/lib/ledger.ts`:

```ts
openLedger(): Ledger
interface Ledger {
  // impressions
  record(i: LocalImpression): void
  listUnsynced(limit: number): LocalImpression[]
  markSynced(ids: string[], at: number): void
  markImpressionsTerminal(ids: string[]): void   // writes synced_at = -1 (tombstone)
  unsyncedCount(): number

  // clicks (v2)
  recordClick(c: LocalClick): void
  listUnsyncedClicks(limit: number): LocalClick[]
  markClicksSynced(ids: string[], at: number): void
  markClicksTerminal(ids: string[]): void        // writes synced_at = -1 (tombstone)
  unsyncedClickCount(): number

  close(): void
}
```

`record()` and `recordClick()` use `INSERT OR IGNORE` on the primary key, so replay-safe retries are free.

`markSynced()` and `markClicksSynced()` chunk at 500 ids per UPDATE inside a single transaction, staying well under SQLite's default `SQLITE_LIMIT_VARIABLE_NUMBER` (999). Large post-offline sync batches won't throw.

## Corruption recovery

If the DB file is unreadable on open (bad header, partial write from a killed process), the module rotates it to `ledger.db.corrupt.<ts>` and creates a fresh database. A warning goes to stderr. The user keeps working; the only loss is the unsynced buffer. Corrupted files are kept for post-mortem, not deleted.

## Sync semantics

The sync loop (`packages/cli/src/lib/daemon/sync.ts`) runs on a 5-minute timer inside the daemon and can be triggered manually via `distro sync --force`. One cycle:

```ts
const impressions = ledger.listUnsynced(250)
const clicks = ledger.listUnsyncedClicks(250)
const result = await apiClient.postIngest({ impressions, clicks })
// per-item: terminal errors → markImpressionsTerminal / markClicksTerminal
//           ok              → markSynced / markClicksSynced
```

Each cycle pulls up to 250 impressions + 250 clicks (under the backend 500-item cap).

## Out of scope for MVP

- Retention / compaction — at 100 devs × 60 impressions/day × ~250B/row the file grows ~15KB/user/day. A year's data fits in 6MB. Compaction is not worth the code.
- Encryption at rest — 0600 perms are enough until we're handling more than USDC amounts.
- Multi-writer coordination — daemon is a per-user singleton; WAL would serialize in a pinch but we don't intentionally run two writers.

## Testing

`packages/cli/src/lib/__tests__/ledger.test.ts` covers open/migrate, record+restart, duplicate id handling, mark-synced, corrupt-DB rotation, and perm bits. Tests use a temp `HOME` per-case so `configDir()` sandboxes cleanly.
