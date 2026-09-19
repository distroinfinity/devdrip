import { describe, it, expect, beforeEach, afterEach } from "vitest"
import request from "supertest"
import express from "express"
import { cliVersionRouter } from "../cli-version.js"

function buildApp() {
  const app = express()
  app.use(express.json())
  app.use("/cli", cliVersionRouter)
  return app
}

describe("GET /cli/version-check", () => {
  let originalEnv: string | undefined

  beforeEach(() => {
    originalEnv = process.env["LATEST_CLI_VERSION"]
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env["LATEST_CLI_VERSION"]
    } else {
      process.env["LATEST_CLI_VERSION"] = originalEnv
    }
  })

  it("missing current → 400", async () => {
    const app = buildApp()
    const res = await request(app).get("/cli/version-check")
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: "missing_current" })
  })

  it("empty current → 400", async () => {
    const app = buildApp()
    const res = await request(app).get("/cli/version-check?current=")
    expect(res.status).toBe(400)
    expect(res.body).toEqual({ error: "missing_current" })
  })

  it("LATEST_CLI_VERSION unset → kill-switch: outdated=false, tarballUrl=''", async () => {
    delete process.env["LATEST_CLI_VERSION"]
    const app = buildApp()
    const res = await request(app).get("/cli/version-check?current=0.2.9")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ latest: "0.2.9", outdated: false, tarballUrl: "" })
  })

  it("LATEST_CLI_VERSION set, current outdated → outdated=true with tarballUrl", async () => {
    process.env["LATEST_CLI_VERSION"] = "0.2.11"
    const app = buildApp()
    const res = await request(app).get("/cli/version-check?current=0.2.9")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      latest: "0.2.11",
      outdated: true,
      tarballUrl:
        "https://github.com/distroinfinity/devdrip/releases/download/cli-v0.2.11/distrotv-cli.tar.gz",
    })
  })

  it("LATEST_CLI_VERSION set, current up-to-date → outdated=false", async () => {
    process.env["LATEST_CLI_VERSION"] = "0.2.11"
    const app = buildApp()
    const res = await request(app).get("/cli/version-check?current=0.2.11")
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      latest: "0.2.11",
      outdated: false,
      tarballUrl:
        "https://github.com/distroinfinity/devdrip/releases/download/cli-v0.2.11/distrotv-cli.tar.gz",
    })
  })
})
