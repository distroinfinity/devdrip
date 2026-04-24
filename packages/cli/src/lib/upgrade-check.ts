import { randomBytes } from "node:crypto"
import { mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { configDir } from "./config.js"

const REGISTRY_URL = "https://registry.npmjs.org/@devdrip/cli/latest"
const FETCH_TIMEOUT_MS = 1500
// Sprint-5 ticket says "weekly" auto-check. 7 days keeps the nudge visible
// without hammering the registry. overridden by --force in the upgrade cmd.
export const CHECK_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

export function upgradeCheckPath(): string {
  return join(configDir(), "upgrade-check.json")
}

interface UpgradeCheckFile {
  checkedAt: number
  latestVersion: string
}

export interface UpgradeCheckResult {
  latest: string
  outdated: boolean
  // true when the result came out of the 7-day cache rather than the network.
  // the cli prints the cached copy just as confidently — it's only stale if
  // the registry published a release in the last week and we missed it.
  cached: boolean
}

// Split on "." and numeric-compare part by part. pre-release suffixes
// ("1.2.3-beta.0") downgrade a version below its plain counterpart, which
// matches npm's semver ordering for the common cases we care about. this is
// intentionally not a full semver library — the only comparisons we make are
// against the current package.json version, which we control.
export function compareSemver(a: string, b: string): -1 | 0 | 1 {
  const [aCore, aPre] = splitCoreAndPre(a)
  const [bCore, bPre] = splitCoreAndPre(b)
  const aParts = aCore.split(".").map(toIntSafe)
  const bParts = bCore.split(".").map(toIntSafe)
  const len = Math.max(aParts.length, bParts.length)
  for (let i = 0; i < len; i++) {
    const av = aParts[i] ?? 0
    const bv = bParts[i] ?? 0
    if (av < bv) return -1
    if (av > bv) return 1
  }
  // same core — anything with a pre-release tag sorts below the plain release
  if (aPre && !bPre) return -1
  if (!aPre && bPre) return 1
  if (aPre && bPre) {
    if (aPre < bPre) return -1
    if (aPre > bPre) return 1
  }
  return 0
}

function splitCoreAndPre(v: string): [string, string] {
  const idx = v.indexOf("-")
  if (idx === -1) return [v, ""]
  return [v.slice(0, idx), v.slice(idx + 1)]
}

function toIntSafe(s: string): number {
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : 0
}

export async function fetchLatestVersion(signal?: AbortSignal): Promise<string> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  const composedSignal = signal ? anySignal([signal, controller.signal]) : controller.signal
  try {
    const res = await fetch(REGISTRY_URL, { signal: composedSignal })
    if (!res.ok) {
      throw new Error(`registry returned ${res.status}`)
    }
    const body = (await res.json()) as { version?: unknown }
    if (typeof body.version !== "string" || body.version.length === 0) {
      throw new Error("registry response missing version")
    }
    return body.version
  } finally {
    clearTimeout(timer)
  }
}

function anySignal(signals: AbortSignal[]): AbortSignal {
  // Node 20+ has AbortSignal.any. fall back to a manual hook if older.
  const any = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any
  if (typeof any === "function") return any(signals)
  const ctl = new AbortController()
  for (const s of signals) {
    if (s.aborted) {
      ctl.abort(s.reason)
      break
    }
    s.addEventListener("abort", () => ctl.abort(s.reason), { once: true })
  }
  return ctl.signal
}

export async function readUpgradeCheckCache(): Promise<UpgradeCheckFile | null> {
  try {
    const raw = await readFile(upgradeCheckPath(), "utf8")
    const parsed = JSON.parse(raw) as Partial<UpgradeCheckFile>
    if (typeof parsed.checkedAt !== "number" || typeof parsed.latestVersion !== "string") {
      return null
    }
    return { checkedAt: parsed.checkedAt, latestVersion: parsed.latestVersion }
  } catch {
    return null
  }
}

export async function writeUpgradeCheckCache(data: UpgradeCheckFile): Promise<void> {
  const dir = configDir()
  const target = upgradeCheckPath()
  const tmp = join(dir, `.upgrade-check.${randomBytes(6).toString("hex")}.tmp`)
  await mkdir(dir, { recursive: true, mode: 0o700 })
  await writeFile(tmp, JSON.stringify(data, null, 2), { mode: 0o600 })
  await rename(tmp, target)
}

export interface MaybeCheckOpts {
  force?: boolean
  now?: () => number
  // test seams — callers normally let these default
  fetchLatest?: (signal?: AbortSignal) => Promise<string>
  timeoutMs?: number
}

// maybeCheck returns null only when the caller passed a custom timeoutMs and
// the fetch was aborted before completing (used by status.ts's passive 500ms
// check). --force and direct invocations always return a result or throw.
export async function maybeCheck(
  current: string,
  opts: MaybeCheckOpts = {}
): Promise<UpgradeCheckResult | null> {
  const now = opts.now ?? (() => Date.now())
  const doFetch = opts.fetchLatest ?? fetchLatestVersion

  if (!opts.force) {
    const cache = await readUpgradeCheckCache()
    if (cache && now() - cache.checkedAt < CHECK_INTERVAL_MS) {
      return {
        latest: cache.latestVersion,
        outdated: compareSemver(current, cache.latestVersion) < 0,
        cached: true,
      }
    }
  }

  let latest: string
  try {
    if (opts.timeoutMs !== undefined) {
      const ctl = new AbortController()
      const timer = setTimeout(() => ctl.abort(), opts.timeoutMs)
      try {
        latest = await doFetch(ctl.signal)
      } finally {
        clearTimeout(timer)
      }
    } else {
      latest = await doFetch()
    }
  } catch (err) {
    if (opts.timeoutMs !== undefined) {
      // passive path swallows errors — null means "don't show an upgrade line"
      return null
    }
    throw err
  }

  await writeUpgradeCheckCache({ checkedAt: now(), latestVersion: latest }).catch(() => {
    // non-fatal: next run just re-fetches from the registry
  })
  return {
    latest,
    outdated: compareSemver(current, latest) < 0,
    cached: false,
  }
}
