// minimal semver comparator — covers the cases we control (x.y.z[-pre]).
// pre-release suffix sorts below the plain release, matching npm semver ordering.
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
  // same core version — pre-release sorts below plain release
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
