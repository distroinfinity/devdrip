/**
 * e2e: auto-update pipeline — real tarball, real node subprocess verification.
 *
 * Each test gets an isolated DISTROTV_HOME (mkdtemp). A fixture tarball is built
 * at runtime via the `tar` package. verifyStaged uses the real defaultExec (no
 * exec stub) so it actually spawns `node <staged>/dist/index.js`.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import * as tar from "tar"
import {
  downloadAndStage,
  verifyStaged,
  activate,
  rollback,
  isVersionBad,
} from "../../lib/auto-update.js"
import {
  swapCurrent,
  writeUpdateState,
  readActiveVersion,
  readUpdateState,
  versionDir,
} from "../../lib/install-layout.js"
import { shouldRollbackOnRespawn } from "../../lib/daemon/lifecycle.js"
import { autoUpdateEnabled } from "../../lib/auto-update-config.js"

// ── fixture helpers ───────────────────────────────────────────────────────────

/** Build a fixture tarball from a pre-populated directory. Returns tgzPath. */
async function buildFixtureTarball(fixtureDir: string, tgzPath: string): Promise<void> {
  await tar.c({ gzip: true, file: tgzPath, cwd: fixtureDir }, ["."])
}

/** Minimal "good" fixture: --version prints version, daemon self-check exits 0. */
function writeGoodFixture(dir: string, version: string): void {
  mkdirSync(join(dir, "dist"), { recursive: true })
  writeFileSync(
    join(dir, "dist", "index.js"),
    [
      "const a = process.argv.slice(2)",
      `if (a[0] === "--version") { console.log("${version}"); process.exit(0) }`,
      `if (a[0] === "daemon" && a[1] === "self-check") { process.exit(0) }`,
      "process.exit(0)",
    ].join("\n")
  )
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version }))
}

/** Broken fixture: daemon self-check exits 1. */
function writeBrokenFixture(dir: string, version: string): void {
  mkdirSync(join(dir, "dist"), { recursive: true })
  writeFileSync(
    join(dir, "dist", "index.js"),
    [
      "const a = process.argv.slice(2)",
      `if (a[0] === "--version") { console.log("${version}"); process.exit(0) }`,
      `if (a[0] === "daemon" && a[1] === "self-check") { process.exit(1) }`,
      "process.exit(0)",
    ].join("\n")
  )
  writeFileSync(join(dir, "package.json"), JSON.stringify({ version }))
}

/** Build a fetchImpl stub that streams the contents of a local tarball. */
function makeFetchStub(tgzPath: string): typeof fetch {
  return (async () => {
    const buf = readFileSync(tgzPath)
    const blob = new Blob([buf])
    return new Response(blob.stream() as unknown as ReadableStream, {
      status: 200,
    })
  }) as unknown as typeof fetch
}

/** exec stub for the npm-install step — always succeeds instantly. */
const noopExec = async () => ({ code: 0, stdout: "", stderr: "" })

// ── per-test isolation ────────────────────────────────────────────────────────

let home: string
let tmp: string // scratch space for fixture files

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "dtv-e2e-home-"))
  tmp = mkdtempSync(join(tmpdir(), "dtv-e2e-tmp-"))
  process.env.DISTROTV_HOME = home
})

afterEach(() => {
  delete process.env.DISTROTV_HOME
  delete process.env.DISTRO_NO_AUTOUPDATE
  rmSync(home, { recursive: true, force: true })
  rmSync(tmp, { recursive: true, force: true })
})

// ── lay down an "old" active version ─────────────────────────────────────────

function layOldVersion(v = "0.2.9"): void {
  const dir = versionDir(v)
  mkdirSync(join(dir, "dist"), { recursive: true })
  writeFileSync(join(dir, "dist", "index.js"), `// old ${v}`)
  swapCurrent(v)
}

// ── tests ─────────────────────────────────────────────────────────────────────

describe("auto-update e2e", () => {
  it("test 1 — happy path: real node verifies staged build, activate commits it", async () => {
    layOldVersion("0.2.9")

    // build fixture tarball
    const fixtureDir = join(tmp, "fixture-good")
    writeGoodFixture(fixtureDir, "9.9.9")
    const tgzPath = join(tmp, "cli-good.tar.gz")
    await buildFixtureTarball(fixtureDir, tgzPath)

    // download + stage (fetch stub serves local tarball; npm stub is a no-op)
    const staged = await downloadAndStage("http://fixture/cli.tar.gz", "9.9.9", {
      fetchImpl: makeFetchStub(tgzPath),
      exec: noopExec, // only used for npm install step
    })

    // verifyStaged uses NO exec override → real `node` spawned against staged build
    const ok = await verifyStaged(staged, "9.9.9")
    expect(ok).toBe(true) // real node ran <staged>/dist/index.js --version and daemon self-check

    activate(staged, "9.9.9")
    expect(readActiveVersion()).toBe("9.9.9")
    const state = readUpdateState()
    expect(state?.phase).toBe("probation")
    expect(state?.previousVersion).toBe("0.2.9")
  })

  it("test 2 — broken build: verify returns false, old version stays active", async () => {
    layOldVersion("0.2.9")

    // build broken fixture tarball
    const fixtureDir = join(tmp, "fixture-broken")
    writeBrokenFixture(fixtureDir, "9.9.9")
    const tgzPath = join(tmp, "cli-broken.tar.gz")
    await buildFixtureTarball(fixtureDir, tgzPath)

    const staged = await downloadAndStage("http://fixture/cli.tar.gz", "9.9.9", {
      fetchImpl: makeFetchStub(tgzPath),
      exec: noopExec,
    })

    // real node spawned: self-check exits 1 → verify must return false
    const ok = await verifyStaged(staged, "9.9.9")
    expect(ok).toBe(false)

    // we intentionally do NOT call activate
    expect(readActiveVersion()).toBe("0.2.9")

    // clean up the rejected staging dir (normally the caller does this on verify failure)
    rmSync(staged, { recursive: true, force: true })
  })

  it("test 3 — rollback reverts current and marks new version bad", () => {
    // arrange: 0.2.9 (previous) and 9.9.9 (probation) both present on disk
    layOldVersion("0.2.9")
    mkdirSync(versionDir("9.9.9"), { recursive: true })
    swapCurrent("9.9.9")
    writeUpdateState({
      phase: "probation",
      previousVersion: "0.2.9",
      newVersion: "9.9.9",
      swappedAt: 1000,
    })

    // confirm the rollback trigger fires: probation with no heartbeat after >90s
    const shouldRollback = shouldRollbackOnRespawn({
      state: readUpdateState(),
      lastHeartbeatAt: null,
      now: 1000 + 100_000,
    })
    expect(shouldRollback).toBe(true)

    rollback()
    expect(readActiveVersion()).toBe("0.2.9")
    expect(isVersionBad("9.9.9")).toBe(true)
  })

  it("test 4 — opt-out: env var and config flag both disable auto-update", () => {
    process.env.DISTRO_NO_AUTOUPDATE = "1"
    expect(autoUpdateEnabled({})).toBe(false)

    delete process.env.DISTRO_NO_AUTOUPDATE
    expect(autoUpdateEnabled({ autoUpdate: false })).toBe(false)
    expect(autoUpdateEnabled({})).toBe(true)
  })
})
