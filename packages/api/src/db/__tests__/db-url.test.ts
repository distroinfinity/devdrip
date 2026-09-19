import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { dbUrlForTarget } from "../index.js"

describe("dbUrlForTarget", () => {
  const snapshot = { ...process.env }
  beforeEach(() => {
    delete process.env["DATABASE_URL"]
    delete process.env["DATABASE_URL_UNPOOLED"]
    delete process.env["DATABASE_URL_LOCAL"]
  })
  afterEach(() => {
    process.env = { ...snapshot }
  })

  it("railway → unpooled url, falling back to DATABASE_URL", () => {
    process.env["DATABASE_URL"] = "postgres://pooled/db"
    expect(dbUrlForTarget("railway")).toBe("postgres://pooled/db")
    process.env["DATABASE_URL_UNPOOLED"] = "postgres://direct/db"
    expect(dbUrlForTarget("railway")).toBe("postgres://direct/db")
  })

  it("neon resolves the same remote contract", () => {
    process.env["DATABASE_URL_UNPOOLED"] = "postgres://neon/db"
    expect(dbUrlForTarget("neon")).toBe("postgres://neon/db")
  })

  it("local → DATABASE_URL_LOCAL", () => {
    process.env["DATABASE_URL_LOCAL"] = "postgres://localhost/dev"
    expect(dbUrlForTarget("local")).toBe("postgres://localhost/dev")
  })

  it("throws when the url is missing", () => {
    expect(() => dbUrlForTarget("railway")).toThrow(/database url required/)
  })
})
