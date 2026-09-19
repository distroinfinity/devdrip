import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("../db/index.js", () => ({ getDb: vi.fn() }))

import { generateBatch } from "../services/invite.service.js"
import { getDb } from "../db/index.js"

type ChainableInsert = {
  insert: ReturnType<typeof vi.fn>
  values: ReturnType<typeof vi.fn>
  returning: ReturnType<typeof vi.fn>
}

function makeDb(returningImpl: () => Promise<unknown>): ChainableInsert {
  const returning = vi.fn(returningImpl)
  const values = vi.fn(() => ({ returning }))
  const insert = vi.fn(() => ({ values }))
  return { insert, values, returning }
}

describe("generateBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns rows on first-attempt success", async () => {
    const rows = [{ id: "1", code: "ABCDEFGHJK" }]
    const db = makeDb(() => Promise.resolve(rows))
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>)

    const result = await generateBatch(1)
    expect(result).toEqual(rows)
    expect(db.insert).toHaveBeenCalledTimes(1)
  })

  it("rethrows non-23505 errors immediately (no retry)", async () => {
    const boom = Object.assign(new Error("connection refused"), { code: "08006" })
    const db = makeDb(() => Promise.reject(boom))
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>)

    await expect(generateBatch(5)).rejects.toThrow("connection refused")
    expect(db.insert).toHaveBeenCalledTimes(1)
  })

  it("retries on 23505 collision and returns rows when a later attempt succeeds", async () => {
    const collision = Object.assign(new Error("unique violation"), { code: "23505" })
    const rows = [{ id: "1", code: "XYZABCDEFG" }]
    let calls = 0
    const db = makeDb(() => {
      calls += 1
      if (calls < 3) return Promise.reject(collision)
      return Promise.resolve(rows)
    })
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>)

    const result = await generateBatch(1)
    expect(result).toEqual(rows)
    expect(db.insert).toHaveBeenCalledTimes(3)
  })

  it("after 3 collisions, throws the last pg err (not a bland 'exhausted' message)", async () => {
    const collision = Object.assign(new Error("unique violation"), { code: "23505" })
    const db = makeDb(() => Promise.reject(collision))
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>)

    await expect(generateBatch(1)).rejects.toBe(collision)
    expect(db.insert).toHaveBeenCalledTimes(3)
  })

  it("handles pg err in cause.code (nested)", async () => {
    const boom = Object.assign(new Error("driver wrapper"), {
      cause: { code: "57014" }, // query canceled
    })
    const db = makeDb(() => Promise.reject(boom))
    vi.mocked(getDb).mockReturnValue(db as unknown as ReturnType<typeof getDb>)

    await expect(generateBatch(1)).rejects.toThrow("driver wrapper")
    expect(db.insert).toHaveBeenCalledTimes(1)
  })
})
