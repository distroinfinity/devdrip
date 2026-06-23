import { describe, expect, it } from "vitest"
import { resolveMigrateUrl } from "../migrate.js"

describe("resolveMigrateUrl", () => {
  it("railway → remote unpooled url", () => {
    const r = resolveMigrateUrl({ DB_TARGET: "railway", DATABASE_URL_UNPOOLED: "postgres://r/db" })
    expect(r).toEqual({ target: "remote", url: "postgres://r/db" })
  })

  it("neon → remote (backward compat)", () => {
    const r = resolveMigrateUrl({ DB_TARGET: "neon", DATABASE_URL: "postgres://n/db" })
    expect(r).toEqual({ target: "remote", url: "postgres://n/db" })
  })

  it("unset DB_TARGET defaults to local", () => {
    const r = resolveMigrateUrl({ DATABASE_URL_LOCAL: "postgres://localhost/dev" })
    expect(r).toEqual({ target: "local", url: "postgres://localhost/dev" })
  })
})
