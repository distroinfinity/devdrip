import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs"
import { randomBytes } from "node:crypto"
import { join } from "node:path"
import { configDir } from "./config.js"

// Telemetry feed for CH 03. Claude Code pipes a rich JSON blob to the status
// line command on stdin every render; `distro statusline` parses it here and
// persists a snapshot + a short rolling history. The daemon reads the snapshot
// when it builds a utility slot. Stays entirely local — never uploaded.

const SNAPSHOT_VERSION = 1
const HISTORY_MAX = 30

// Fields we lift straight from the latest stdin payload.
export interface UsageLatest {
  ts: number
  cwd?: string
  repoName?: string
  costUsd?: number
  linesAdded?: number
  linesRemoved?: number
  model?: string
  effort?: string
  ctxPct?: number
  ctxSize?: number
  cachePct?: number
  fiveHourPct?: number
  fiveHourResetAt?: number // epoch ms
  sevenDayPct?: number
  sevenDayResetAt?: number // epoch ms
  version?: string
}

// Trimmed sample kept in the ring buffer for rate derivation.
interface UsageSample {
  ts: number
  costUsd?: number
  fiveHourPct?: number
  sevenDayPct?: number
}

interface UsageSnapshot {
  version: number
  latest: UsageLatest
  history: UsageSample[]
}

export interface UsageDerived {
  burnUsdPerMin?: number
  timeToLimitMin?: number
}

function snapshotPath(): string {
  return join(configDir(), "claude-usage.json")
}

function num(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined
}

// resets_at comes through as epoch seconds; normalize to ms. Guard values that
// already look like ms so we don't double-scale.
function toMs(v: unknown): number | undefined {
  const n = num(v)
  if (n === undefined) return undefined
  return n < 1e12 ? Math.round(n * 1000) : Math.round(n)
}

function clampPct(v: number | undefined): number | undefined {
  if (v === undefined) return undefined
  return Math.max(0, Math.min(100, Math.round(v)))
}

// Strip "Claude " + any trailing parenthetical, mirroring the reference script.
function cleanModel(name: string | undefined): string | undefined {
  if (!name) return undefined
  return name
    .replace(/^Claude /, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim()
}

// Parse the Claude Code status-line stdin JSON into our latest-fields shape.
// Tolerant: every field is optional and bad input yields an empty-ish object.
export function parseStatuslineInput(raw: string, now: number): UsageLatest {
  let j: Record<string, unknown> = {}
  try {
    j = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return { ts: now }
  }
  const pick = (path: string[]): unknown => {
    let cur: unknown = j
    for (const k of path) {
      if (cur === null || typeof cur !== "object") return undefined
      cur = (cur as Record<string, unknown>)[k]
    }
    return cur
  }

  // cache hit rate = reads / (reads + fresh uncached input). cache_creation
  // tokens are writes (being stored for the first time), not reads — counting
  // them in the denominator deflated the % while a session was building its
  // cache, so they're excluded.
  const cacheRead = num(pick(["context_window", "current_usage", "cache_read_input_tokens"])) ?? 0
  const inTok = num(pick(["context_window", "current_usage", "input_tokens"])) ?? 0
  const cacheDenom = cacheRead + inTok
  const cachePct = cacheDenom > 0 ? Math.round((cacheRead * 100) / cacheDenom) : undefined

  return {
    ts: now,
    cwd: str(pick(["workspace", "current_dir"])) ?? str(pick(["cwd"])),
    repoName: str(pick(["workspace", "repo", "name"])),
    costUsd: num(pick(["cost", "total_cost_usd"])),
    linesAdded: num(pick(["cost", "total_lines_added"])),
    linesRemoved: num(pick(["cost", "total_lines_removed"])),
    model: cleanModel(str(pick(["model", "display_name"]))),
    effort: str(pick(["effort", "level"])) ?? str(pick(["model", "reasoning_effort"])),
    ctxPct: clampPct(num(pick(["context_window", "used_percentage"]))),
    ctxSize: num(pick(["context_window", "context_window_size"])),
    cachePct,
    fiveHourPct: clampPct(num(pick(["rate_limits", "five_hour", "used_percentage"]))),
    fiveHourResetAt: toMs(pick(["rate_limits", "five_hour", "resets_at"])),
    sevenDayPct: clampPct(num(pick(["rate_limits", "seven_day", "used_percentage"]))),
    sevenDayResetAt: toMs(pick(["rate_limits", "seven_day", "resets_at"])),
    version: str(pick(["version"])),
  }
}

function readSnapshot(): UsageSnapshot | null {
  try {
    const parsed = JSON.parse(readFileSync(snapshotPath(), "utf8")) as UsageSnapshot
    if (parsed?.version !== SNAPSHOT_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

function writeSnapshot(snap: UsageSnapshot): void {
  try {
    const dir = configDir()
    mkdirSync(dir, { recursive: true, mode: 0o700 })
    const tmp = join(dir, `.claude-usage.${randomBytes(6).toString("hex")}.tmp`)
    writeFileSync(tmp, JSON.stringify(snap), { mode: 0o600 })
    renameSync(tmp, snapshotPath())
  } catch {
    /* never throw from the status-line path */
  }
}

// Append a freshly-parsed sample, capped at HISTORY_MAX. Called once per
// status-line render — must be fast and never throw.
export function recordUsage(latest: UsageLatest): void {
  const prev = readSnapshot()
  const history = prev?.history ?? []
  history.push({
    ts: latest.ts,
    costUsd: latest.costUsd,
    fiveHourPct: latest.fiveHourPct,
    sevenDayPct: latest.sevenDayPct,
  })
  while (history.length > HISTORY_MAX) history.shift()
  writeSnapshot({ version: SNAPSHOT_VERSION, latest, history })
}

// Read the snapshot once and return both the latest fields (or null when stale)
// and the derived burn-rate / time-to-limit — a single file read per call, so
// the per-rotation render path doesn't read the same file twice.
export function loadUsage(
  now: number,
  staleMs: number
): { latest: UsageLatest | null; derived: UsageDerived } {
  const snap = readSnapshot()
  if (!snap) return { latest: null, derived: {} }
  const latest = now - snap.latest.ts > staleMs ? null : snap.latest
  return { latest, derived: deriveFromSnapshot(snap, now) }
}

// Rolling window for burn-rate / projection — deliberately independent of the
// snapshot staleness cutoff.
const BURN_RATE_WINDOW_MS = 10 * 60_000

// Burn rate ($/min) from cumulative cost over BURN_RATE_WINDOW_MS, and a
// projection of minutes until the nearest rate-limit window hits 100%.
function deriveFromSnapshot(snap: UsageSnapshot, now: number): UsageDerived {
  const hist = snap.history.filter((s) => now - s.ts <= BURN_RATE_WINDOW_MS)
  if (hist.length < 2) return {}
  const first = hist[0]
  const last = hist[hist.length - 1]
  if (!first || !last) return {}
  const dtMin = (last.ts - first.ts) / 60_000
  if (dtMin <= 0) return {}

  const out: UsageDerived = {}
  if (first.costUsd !== undefined && last.costUsd !== undefined) {
    const dCost = last.costUsd - first.costUsd
    if (dCost > 0) out.burnUsdPerMin = dCost / dtMin
  }

  // project minutes-to-100% for whichever window is climbing fastest.
  const proj = (firstPct?: number, lastPct?: number): number | undefined => {
    if (firstPct === undefined || lastPct === undefined) return undefined
    const rate = (lastPct - firstPct) / dtMin // pct per min
    if (rate <= 0) return undefined
    return Math.max(0, (100 - lastPct) / rate)
  }
  const five = proj(first.fiveHourPct, last.fiveHourPct)
  const seven = proj(first.sevenDayPct, last.sevenDayPct)
  const candidates = [five, seven].filter((v): v is number => v !== undefined)
  if (candidates.length > 0) out.timeToLimitMin = Math.round(Math.min(...candidates))
  return out
}
