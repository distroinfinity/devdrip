import { describe, it, expect, beforeEach, afterEach, vi } from "vitest"
import { mkdtempSync, rmSync, statSync, writeFileSync, readFileSync, readdirSync } from "node:fs"
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
      expect(db.pragma("user_version", { simple: true })).toBe(1)
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
