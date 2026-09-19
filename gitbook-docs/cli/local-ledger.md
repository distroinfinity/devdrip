# Local Impression Ledger

Ground truth for earnings. The daemon records every impression locally before the backend sees it, and `devdrip sync` batches unsynced rows to `POST /impressions` when the network is reachable.

## Why local

- **Latency** — hooks must vanish the ad in under 200ms (see `packages/shared/src/constants/index.ts:VANISH_DEADLINE_MS`). Writing to SQLite is a few microseconds; a backend round-trip is tens of milliseconds minimum.
- **Never-block hooks** — the Claude Code hook contract requires `exit 0`. Network failures or slow backends can't be allowed to stall the hook path.
- **Transient backend gaps** — Railway redeploys, Neon failovers, and wifi wobbles are routine during hour-long Claude sessions. A local buffer absorbs them; impressions sync whenever the backend comes back.
- **User-verifiable earnings** — `devdrip status --local` lets the dev audit what was shown and when, independent of server state.

## Storage

- Path: `~/.devdrip/ledger.db`
- Dir mode: `0700`, file mode: `0600`. WAL sidecars (`ledger.db-wal`, `ledger.db-shm`) also chmod'd to `0600` after the first write, since they carry the same rows between checkpoints.
- SQLite via `better-sqlite3`, WAL mode (`PRAGMA journal_mode=WAL; synchronous=NORMAL`)
- Schema version tracked in `PRAGMA user_version`
- `devdrip status --local` is strictly read-only: if `ledger.db` doesn't exist it prints `unsynced: 0` without creating it. The file is only ever created by the daemon on first impression write.

## Schema

```sql
CREATE TABLE impressions (
  id             TEXT PRIMARY KEY,  -- crypto.randomUUID(); also the backend idempotency key
  ad_id          TEXT NOT NULL,
  campaign_id    TEXT NOT NULL,
  surface        TEXT NOT NULL,     -- "terminal-tv" for MVP
  source         TEXT NOT NULL,     -- "direct" | "carbon" | ... (observability only)
  delivery_token TEXT NOT NULL,     -- JWT issued by GET /ads/batch; required by POST /impressions
  started_at     INTEGER NOT NULL,  -- epoch ms, client clock
  duration_ms    INTEGER NOT NULL,
  result         TEXT NOT NULL,     -- matches ImpressionResult: completed|skipped|expired|interrupted
  device_id      TEXT NOT NULL,
  cpm_rate       REAL,              -- cached for local earnings preview; backend recomputes
  synced_at      INTEGER            -- epoch ms; NULL = pending
);
CREATE INDEX idx_impressions_unsynced
  ON impressions (synced_at) WHERE synced_at IS NULL;
```

Client-generated UUIDs serve as the idempotency key: the backend dedupes on replay, so a mid-sync crash or retry can't double-count.

## Module API

`packages/cli/src/lib/ledger.ts`:

```ts
openLedger(): Ledger
interface Ledger {
  record(i: LocalImpression): void
  listUnsynced(limit: number): LocalImpression[]
  markSynced(ids: string[], at: number): void
  unsyncedCount(): number
  close(): void
}
```

`record()` uses `INSERT OR IGNORE` on the primary key, so replay-safe retries are free.

`markSynced()` chunks at 500 ids per UPDATE inside a single transaction, staying well under SQLite's default `SQLITE_LIMIT_VARIABLE_NUMBER` (999). Large post-offline sync batches won't throw.

## Corruption recovery

If the DB file is unreadable on open (bad header, partial write from a killed process), the module rotates it to `ledger.db.corrupt.<ts>` and creates a fresh database. A warning goes to stderr. The user keeps working; the only loss is the unsynced buffer. Corrupted files are kept for post-mortem, not deleted.

## Sync semantics (to be implemented in the `devdrip sync` ticket)

Pseudocode the sync command will run:

```ts
const ledger = openLedger()
const batch = ledger.listUnsynced(100)
const ids = batch.map((i) => i.id)
await apiFetch("/impressions", { method: "POST", body: { impressions: batch } })
ledger.markSynced(ids, Date.now())
```

The daemon triggers sync on a timer (~every 5 minutes) and opportunistically after each successful `/ads/batch` refresh.

## Out of scope for MVP

- Retention / compaction — at 100 devs × 60 impressions/day × ~250B/row the file grows ~15KB/user/day. A year's data fits in 6MB. Compaction is not worth the code.
- Encryption at rest — 0600 perms are enough until we're handling more than USDC amounts.
- Multi-writer coordination — daemon is a per-user singleton; WAL would serialize in a pinch but we don't intentionally run two writers.

## Testing

`packages/cli/src/lib/__tests__/ledger.test.ts` covers open/migrate, record+restart, duplicate id handling, mark-synced, corrupt-DB rotation, and perm bits. Tests use a temp `HOME` per-case so `configDir()` sandboxes cleanly.
