import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import {
  existsSync,
  mkdtempSync,
  rmSync,
  statSync,
  writeFileSync,
  readFileSync,
  readdirSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

let tempHome: string
let warnSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "devdrip-ledger-test-"))
  process.env["HOME"] = tempHome
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
})

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true })
  warnSpy.mockRestore()
})

function sampleImpression(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: (overrides["id"] as string) ?? crypto.randomUUID(),
    adId: "ad-1",
    campaignId: "camp-1",
    surface: "terminal-tv",
    source: "direct",
    deliveryToken: "tok-1",
    startedAt: Date.now(),
    durationMs: 3000,
    result: "completed" as const,
    deviceId: "dev-1",
    cpmRate: 2.5,
    ...overrides,
  }
}

describe("ledger", () => {
  it("creates table + indices + user_version on first open, WAL mode, correct perms", async () => {
    const { openLedger, ledgerPath } = await import("../ledger.js")
    const l = openLedger()
    l.close()

    const path = ledgerPath()
    const Database = (await import("better-sqlite3")).default
    const db = new Database(path, { readonly: true })
    try {
      expect(db.pragma("user_version", { simple: true })).toBe(2)
      expect(db.pragma("journal_mode", { simple: true })).toBe("wal")

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table'")
        .all()
        .map((r: unknown) => (r as { name: string }).name)
      expect(tables).toContain("impressions")

      const indices = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index'")
        .all()
        .map((r: unknown) => (r as { name: string }).name)
      expect(indices).toContain("idx_impressions_unsynced")
    } finally {
      db.close()
    }

    if (process.platform !== "win32") {
      expect(statSync(join(tempHome, ".devdrip")).mode & 0o777).toBe(0o700)
      expect(statSync(path).mode & 0o777).toBe(0o600)
      // WAL sidecars carry the same rows between checkpoints — must be 0600 too
      for (const suffix of ["-wal", "-shm"]) {
        const p = path + suffix
        if (existsSync(p)) {
          expect(statSync(p).mode & 0o777).toBe(0o600)
        }
      }
    }
  })

  it("is idempotent across re-opens", async () => {
    const { openLedger } = await import("../ledger.js")
    const l1 = openLedger()
    l1.close()
    const l2 = openLedger()
    expect(l2.unsyncedCount()).toBe(0)
    l2.close()
  })

  it("record() persists across restart and listUnsynced returns the row", async () => {
    const { openLedger } = await import("../ledger.js")
    const l1 = openLedger()
    const imp = sampleImpression()
    l1.record(imp)
    l1.close()

    const l2 = openLedger()
    const rows = l2.listUnsynced(10)
    expect(rows).toHaveLength(1)
    expect(rows[0]?.id).toBe(imp.id)
    expect(rows[0]?.adId).toBe("ad-1")
    expect(rows[0]?.result).toBe("completed")
    expect(rows[0]?.cpmRate).toBe(2.5)
    expect(l2.unsyncedCount()).toBe(1)
    l2.close()
  })

  it("record() ignores duplicate ids", async () => {
    const { openLedger } = await import("../ledger.js")
    const l = openLedger()
    const id = crypto.randomUUID()
    l.record(sampleImpression({ id }))
    expect(() => l.record(sampleImpression({ id }))).not.toThrow()
    expect(l.unsyncedCount()).toBe(1)
    l.close()
  })

  it("markSynced() removes rows from the unsynced index", async () => {
    const { openLedger } = await import("../ledger.js")
    const l = openLedger()
    const a = sampleImpression()
    const b = sampleImpression()
    l.record(a)
    l.record(b)
    expect(l.unsyncedCount()).toBe(2)

    l.markSynced([a.id], Date.now())
    expect(l.unsyncedCount()).toBe(1)
    expect(l.listUnsynced(10)[0]?.id).toBe(b.id)

    l.markSynced([b.id], Date.now())
    expect(l.unsyncedCount()).toBe(0)
    l.close()
  })

  it("markSynced chunks large batches (over SQLite's 999-variable limit)", async () => {
    const { openLedger } = await import("../ledger.js")
    const l = openLedger()
    const ids: string[] = []
    const now = Date.now()
    for (let i = 0; i < 1100; i++) {
      const id = crypto.randomUUID()
      ids.push(id)
      l.record(sampleImpression({ id, startedAt: now + i }))
    }
    expect(l.unsyncedCount()).toBe(1100)
    // without chunking this throws "too many SQL variables"
    expect(() => l.markSynced(ids, Date.now())).not.toThrow()
    expect(l.unsyncedCount()).toBe(0)
    l.close()
  })

  it("markSynced([]) is a no-op", async () => {
    const { openLedger } = await import("../ledger.js")
    const l = openLedger()
    l.record(sampleImpression())
    expect(() => l.markSynced([], Date.now())).not.toThrow()
    expect(l.unsyncedCount()).toBe(1)
    l.close()
  })

  it("rotates a corrupt DB file and opens fresh", async () => {
    // create a fake devdrip dir + corrupt DB by writing garbage bytes
    const { ledgerPath } = await import("../ledger.js")
    const devdripDir = join(tempHome, ".devdrip")
    const { mkdirSync } = await import("node:fs")
    mkdirSync(devdripDir, { recursive: true, mode: 0o700 })
    writeFileSync(ledgerPath(), Buffer.from("not a sqlite database at all"))

    const { openLedger } = await import("../ledger.js")
    const l = openLedger()
    expect(l.unsyncedCount()).toBe(0) // fresh DB is empty
    expect(warnSpy).toHaveBeenCalledOnce()

    // confirm the rotated file is around
    const entries = readdirSync(devdripDir)
    expect(entries.some((e) => e.startsWith("ledger.db.corrupt."))).toBe(true)

    // rotated file should still contain our garbage
    const rotated = entries.find((e) => e.startsWith("ledger.db.corrupt."))
    expect(rotated).toBeDefined()
    expect(readFileSync(join(devdripDir, rotated as string)).toString()).toBe(
      "not a sqlite database at all"
    )
    l.close()
  })
})

describe("v2 clicks table", () => {
  it("opens a v1 ledger and migrates to v2 without losing impressions", async () => {
    const { ledgerPath, openLedger } = await import("../ledger.js")
    const Database = (await import("better-sqlite3")).default

    // build a v1 schema manually and insert an impression row
    const devdripDir = join(tempHome, ".devdrip")
    const { mkdirSync } = await import("node:fs")
    mkdirSync(devdripDir, { recursive: true, mode: 0o700 })
    const dbPath = ledgerPath()
    const db = new Database(dbPath)
    db.exec(`
      CREATE TABLE impressions (
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
      CREATE INDEX idx_impressions_unsynced ON impressions (synced_at) WHERE synced_at IS NULL;
    `)
    db.pragma("user_version = 1")
    db.prepare(
      `
      INSERT INTO impressions (id, ad_id, campaign_id, surface, source, delivery_token,
        started_at, duration_ms, result, device_id, cpm_rate, synced_at)
      VALUES ('imp-v1', 'ad-1', 'camp-1', 'terminal-tv', 'api', 'tok-v1',
        1000, 5000, 'completed', 'dev-1', 2.5, NULL)
    `
    ).run()
    db.close()

    // open via openLedger — should migrate to v2
    const ledger = openLedger()
    // original impression still accessible
    expect(ledger.listUnsynced(10).some((r) => r.id === "imp-v1")).toBe(true)
    // clicks table now exists — probe by writing and counting
    ledger.recordClick({ id: "c-probe", deliveryToken: "tok-probe", createdAt: Date.now() })
    expect(ledger.unsyncedClickCount()).toBe(1)
    ledger.close()
  })

  it("records and lists unsynced clicks", async () => {
    const { openLedger } = await import("../ledger.js")
    const ledger = openLedger()
    ledger.recordClick({ id: "c-1", deliveryToken: "tok-1", createdAt: Date.now() })
    expect(ledger.unsyncedClickCount()).toBe(1)
    const list = ledger.listUnsyncedClicks(10)
    expect(list[0]?.deliveryToken).toBe("tok-1")
    ledger.close()
  })

  it("markClicksSynced excludes rows from listUnsyncedClicks", async () => {
    const { openLedger } = await import("../ledger.js")
    const ledger = openLedger()
    ledger.recordClick({ id: "c-2", deliveryToken: "tok-2", createdAt: Date.now() })
    ledger.markClicksSynced(["c-2"], Date.now())
    expect(ledger.listUnsyncedClicks(10)).toHaveLength(0)
    ledger.close()
  })
})
