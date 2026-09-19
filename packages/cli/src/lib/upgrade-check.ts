import { apiFetchPublic } from "./api-client.js"

export interface UpdateInfo {
  latest: string
  outdated: boolean
  tarballUrl: string
}

// ask OUR server whether this CLI is outdated. returns null on any network
// failure — passive callers (status.ts nudge) swallow null silently.
// no local cache: the server call is cheap and the daemon already rate-limits
// via its 15-min periodic tick.
export async function checkForUpdate(
  current: string,
  opts: { timeoutMs?: number } = {}
): Promise<UpdateInfo | null> {
  try {
    return await apiFetchPublic<UpdateInfo>("/cli/version-check", {
      query: { current },
      timeoutMs: opts.timeoutMs,
    })
  } catch {
    return null
  }
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
