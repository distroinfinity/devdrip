import { afterEach, describe, expect, it, vi } from "vitest"

describe("env.dbTarget", () => {
  const prev = process.env["DB_TARGET"]
  afterEach(() => {
    if (prev === undefined) delete process.env["DB_TARGET"]
    else process.env["DB_TARGET"] = prev
  })

  it("accepts railway", async () => {
    process.env["DB_TARGET"] = "railway"
    const { env } = await import("../env.js")
    expect(env.dbTarget).toBe("railway")
  })

  it("accepts neon (backward compat)", async () => {
    process.env["DB_TARGET"] = "neon"
    const { env } = await import("../env.js")
    expect(env.dbTarget).toBe("neon")
  })

  it("rejects an unknown target", async () => {
    process.env["DB_TARGET"] = "bogus"
    const { env } = await import("../env.js")
    expect(() => env.dbTarget).toThrow(/DB_TARGET/)
  })
})

describe("assertEnvSafe", () => {
  it("refuses dev + railway without the escape hatch", async () => {
    vi.resetModules()
    process.env["NODE_ENV"] = "development"
    process.env["DB_TARGET"] = "railway"
    delete process.env["DISTROTV_ALLOW_NEON_IN_DEV"]
    const { assertEnvSafe } = await import("../env.js")
    expect(() => assertEnvSafe()).toThrow(/refusing to start/)
    process.env["NODE_ENV"] = "test"
    process.env["DB_TARGET"] = "local"
    vi.resetModules()
  })

  it("allows dev + local", async () => {
    vi.resetModules()
    process.env["NODE_ENV"] = "development"
    process.env["DB_TARGET"] = "local"
    const { assertEnvSafe } = await import("../env.js")
    expect(() => assertEnvSafe()).not.toThrow()
    process.env["NODE_ENV"] = "test"
    vi.resetModules()
  })
})
