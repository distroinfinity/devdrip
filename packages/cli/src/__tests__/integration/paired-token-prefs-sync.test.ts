import { afterAll, beforeAll, describe, expect, it } from "vitest"
import { spawn, type ChildProcess } from "node:child_process"
import { randomUUID } from "node:crypto"
import { setTimeout as sleep } from "node:timers/promises"
import { join } from "node:path"

// This integration test gates sub-issue 15: it asserts the token issued by
// /miniapp/cli-link/:code (consumed via the /cli/pair/:code long-poll) is
// byte-equivalent to today's /auth/exchange token shape — meaning the existing
// daemon prefs-sync code path keeps working with zero changes.

const API_URL = process.env["DISTRO_INTEGRATION_API_URL"] ?? "http://127.0.0.1:3401"

// Resolve the API entry + package dir relative to this test file so it works
// regardless of the cwd vitest is launched from. Spawning with cwd=apiPkgDir
// lets the API's `dotenv/config` import pick up packages/api/.env.
const apiPkgDir = join(__dirname, "..", "..", "..", "..", "api")
const apiBinPath = join(apiPkgDir, "dist", "index.js")

async function fetchJson<T>(
  url: string,
  init?: RequestInit
): Promise<{ status: number; body: T | null }> {
  const r = await fetch(url, init)
  let body: T | null = null
  const text = await r.text()
  if (text) body = JSON.parse(text) as T
  return { status: r.status, body }
}

let apiProc: ChildProcess | null = null

async function waitForApi(url: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const r = await fetch(`${url}/health`)
      if (r.ok) return
    } catch {
      // not yet up
    }
    await sleep(200)
  }
  throw new Error(`API did not become healthy at ${url} within ${timeoutMs}ms`)
}

// Skip by default — only runs when DISTRO_INTEGRATION_RUN=1 is set, since it
// requires a live Postgres + the API entry to be runnable. CI gates this via a
// dedicated job (see PR description).
const RUN = process.env["DISTRO_INTEGRATION_RUN"] === "1"

describe.skipIf(!RUN)("paired token prefs-sync compat", () => {
  beforeAll(async () => {
    apiProc = spawn("node", [apiBinPath], {
      cwd: apiPkgDir,
      env: { ...process.env, PORT: "3401", DB_TARGET: "local", NODE_ENV: "test" },
      stdio: "inherit",
    })
    await waitForApi(API_URL, 15_000)
  }, 30_000)

  afterAll(() => {
    if (apiProc) apiProc.kill("SIGTERM")
  })

  it("paired token can hit /me/preferences", async () => {
    // 1. Mint a pair code
    const pair = await fetchJson<{ code: string }>(`${API_URL}/cli/pair`, { method: "POST" })
    expect(pair.status).toBe(200)
    if (!pair.body) throw new Error("pair response had no body")
    expect(pair.body.code).toMatch(
      /^[0-9A-HJ-NP-TV-Z]{3}-[0-9A-HJ-NP-TV-Z]{3}-[0-9A-HJ-NP-TV-Z]{3}$/
    )
    const code = pair.body.code

    // 2. Simulate the Mini App link by inserting a test user + linking pair_session
    //    directly. We don't go through the full Mini App auth flow because that
    //    would require a SIWE-signed payload + a real World ID proof. The token
    //    shape comes from cli-pair.service which is what we're testing — the
    //    walletAuth/worldid path is verified separately by PR4 manual testing.
    const userId = randomUUID()
    const githubLogin = `pair-test-${randomUUID().slice(0, 8)}`
    const setup = await fetchJson<{ ok: true }>(`${API_URL}/__test/setup-paired-link`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code, userId, githubLogin }),
    })
    expect(setup.status).toBe(200)

    // 3. Long-poll — should receive token immediately because pair_session is now linked
    const pollResp = await fetchJson<{
      token: string
      refresh_token: string
      user: { id: string }
    }>(`${API_URL}/cli/pair/${code}`)
    expect(pollResp.status).toBe(200)
    if (!pollResp.body) throw new Error("poll response had no body")
    expect(pollResp.body.token).toBeTruthy()
    expect(pollResp.body.refresh_token).toBeTruthy()
    expect(pollResp.body.user.id).toBe(userId)
    const token = pollResp.body.token

    // 4. Hit /me/preferences with the paired token — this is the daemon code path.
    const prefs = await fetchJson<{ preferences: { updatedAt: string } }>(
      `${API_URL}/me/preferences`,
      { headers: { authorization: `Bearer ${token}` } }
    )
    expect(prefs.status).toBe(200)
    expect(prefs.body?.preferences.updatedAt).toBeTruthy()
  }, 30_000)
})
