import { execFile } from "node:child_process"
import { readFile, statfs } from "node:fs/promises"
import { cpus, platform } from "node:os"
import { promisify } from "node:util"
import {
  UTILITY_GIT_CACHE_MS,
  UTILITY_HEALTH_CACHE_MS,
  UTILITY_MACHINE_CACHE_MS,
  UTILITY_SNAPSHOT_STALE_MS,
  type UtilityGit,
  type UtilityHealth,
  type UtilityLayout,
  type UtilityMachine,
  type UtilityPayload,
} from "@distrotv/shared"
import type { CachedSlot } from "./slot-cache.js"
import { deriveUsage, readUsageSnapshot, type UsageLatest } from "./claude-usage.js"
import { hasWrappedStatusLine } from "./wrapped-statusline.js"

const execFileAsync = promisify(execFile)

export type LayoutPref = "auto" | "full" | "complement"

export interface UtilityProviderDeps {
  now?: () => number
  // CLI-local pref: "auto" picks complement when a custom status line was
  // wrapped at install, else full.
  getLayoutPref?: () => LayoutPref
}

export interface UtilityProvider {
  // Synchronous: assembles the panel from the latest cached probe values + the
  // usage snapshot. Kicks stale probes off in the background (never awaits), so
  // the render path stays fast. Returns null when there's nothing to show.
  build(): CachedSlot | null
}

// ── git probe ───────────────────────────────────────────────────────────────

async function git(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync("git", args, { cwd, timeout: 1500 })
    return stdout.trim()
  } catch {
    return null
  }
}

async function probeGit(cwd: string, now: number): Promise<UtilityGit | null> {
  const branch = await git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"])
  if (branch === null) return null // not a repo / git unavailable

  const [counts, porcelain, numstat, lastCommit] = await Promise.all([
    git(cwd, ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"]),
    git(cwd, ["status", "--porcelain"]),
    git(cwd, ["diff", "--numstat", "HEAD"]),
    git(cwd, ["log", "-1", "--format=%ct"]),
  ])

  const out: UtilityGit = { branch }

  if (counts) {
    const [behind, ahead] = counts.split(/\s+/).map((n) => Number.parseInt(n, 10))
    if (Number.isFinite(behind)) out.behind = behind
    if (Number.isFinite(ahead)) out.ahead = ahead
  }
  if (porcelain !== null) {
    out.dirtyFiles = porcelain.length === 0 ? 0 : porcelain.split("\n").filter(Boolean).length
  }
  if (numstat) {
    let lines = 0
    for (const row of numstat.split("\n")) {
      const [add, del] = row.split(/\s+/)
      const a = Number.parseInt(add ?? "", 10)
      const d = Number.parseInt(del ?? "", 10)
      if (Number.isFinite(a)) lines += a
      if (Number.isFinite(d)) lines += d
    }
    out.uncommittedLines = lines
  }
  if (lastCommit) {
    const ct = Number.parseInt(lastCommit, 10)
    if (Number.isFinite(ct)) out.lastCommitAgeSec = Math.max(0, Math.round(now / 1000 - ct))
  }
  return out
}

// ── machine probe ─────────────────────────────────────────────────────────

function cpuSnapshot(): { idle: number; total: number } {
  let idle = 0
  let total = 0
  for (const c of cpus()) {
    for (const k of Object.keys(c.times) as (keyof typeof c.times)[]) total += c.times[k]
    idle += c.times.idle
  }
  return { idle, total }
}

// real instantaneous CPU% busy: sample cpu times twice ~250ms apart. loadavg
// is not a % and overstates on multi-core boxes, so we never use it.
async function probeCpu(): Promise<number | undefined> {
  const a = cpuSnapshot()
  await new Promise((r) => setTimeout(r, 250))
  const b = cpuSnapshot()
  const dt = b.total - a.total
  if (dt <= 0) return undefined
  return Math.max(0, Math.min(100, Math.round((1 - (b.idle - a.idle) / dt) * 100)))
}

// real memory pressure: os.freemem() is meaningless on macOS (reports ~3% free
// because the OS uses RAM for cache), so use memory_pressure / MemAvailable.
async function probeMem(): Promise<number | undefined> {
  if (platform() === "darwin") {
    try {
      const { stdout } = await execFileAsync("memory_pressure", [], { timeout: 1500 })
      const m = /System-wide memory free percentage:\s*([\d.]+)%/.exec(stdout)
      if (m) return Math.max(0, Math.min(100, Math.round(100 - Number.parseFloat(m[1] as string))))
    } catch {
      /* omit */
    }
    return undefined
  }
  if (platform() === "linux") {
    try {
      const txt = await readFile("/proc/meminfo", "utf8")
      const tot = /MemTotal:\s+(\d+)/.exec(txt)
      const avail = /MemAvailable:\s+(\d+)/.exec(txt)
      if (tot && avail) {
        return Math.round((1 - Number(avail[1]) / Number(tot[1])) * 100)
      }
    } catch {
      /* omit */
    }
  }
  return undefined // never show a misleading fallback
}

async function probeBattery(): Promise<number | undefined> {
  if (platform() !== "darwin") return undefined
  try {
    const { stdout } = await execFileAsync("pmset", ["-g", "batt"], { timeout: 1500 })
    const m = /(\d+)%/.exec(stdout)
    return m ? Number.parseInt(m[1] as string, 10) : undefined
  } catch {
    return undefined
  }
}

async function probeMachine(cwd: string | undefined): Promise<UtilityMachine> {
  const [cpuPct, memPct, battPct] = await Promise.all([probeCpu(), probeMem(), probeBattery()])
  const out: UtilityMachine = {}
  if (cpuPct !== undefined) out.cpuPct = cpuPct
  if (memPct !== undefined) out.memPct = memPct
  if (battPct !== undefined) out.battPct = battPct
  try {
    const stats = await statfs(cwd || process.env["HOME"] || "/")
    const blocks = Number(stats.blocks)
    if (blocks > 0) out.diskUsedPct = Math.round((1 - Number(stats.bavail) / blocks) * 100)
  } catch {
    /* omit */
  }
  return out
}

// ── service-health probe ────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), ms)
  try {
    return await fetch(url, { signal: ctrl.signal, method: "GET" })
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}

async function probeHealth(now: () => number): Promise<UtilityHealth> {
  const out: UtilityHealth = {}
  const start = now()
  // Atlassian Statuspage summary for status.anthropic.com.
  const res = await fetchWithTimeout("https://status.anthropic.com/api/v2/status.json", 2500)
  out.apiLatencyMs = now() - start
  out.online = res !== null
  if (res && res.ok) {
    try {
      const body = (await res.json()) as { status?: { indicator?: string } }
      const ind = body.status?.indicator ?? "none"
      out.anthropic =
        ind === "none" ? "ok" : ind === "critical" || ind === "major" ? "down" : "degraded"
    } catch {
      /* leave anthropic unset */
    }
  }
  return out
}

// ── provider: caches probe results, refreshes stale ones in the background ──

interface Cell<T> {
  value: T | null
  at: number
  inFlight: boolean
}

export function createUtilityProvider(deps: UtilityProviderDeps = {}): UtilityProvider {
  const now = deps.now ?? (() => Date.now())
  const getLayoutPref = deps.getLayoutPref ?? (() => "auto" as LayoutPref)

  const gitCell: Cell<UtilityGit> = { value: null, at: 0, inFlight: false }
  const machineCell: Cell<UtilityMachine> = { value: null, at: 0, inFlight: false }
  const healthCell: Cell<UtilityHealth> = { value: null, at: 0, inFlight: false }

  function refresh<T>(cell: Cell<T>, ttl: number, run: () => Promise<T | null>): void {
    if (cell.inFlight) return
    if (cell.value !== null && now() - cell.at < ttl) return
    cell.inFlight = true
    run()
      .then((v) => {
        cell.value = v
        cell.at = now()
      })
      .catch(() => {})
      .finally(() => {
        cell.inFlight = false
      })
  }

  function resolveLayout(): UtilityLayout {
    const pref = getLayoutPref()
    if (pref === "full" || pref === "complement") return pref
    return hasWrappedStatusLine() ? "complement" : "full"
  }

  function aiFrom(usage: UsageLatest | null): UtilityPayload["ai"] | undefined {
    if (!usage) return undefined
    const derived = deriveUsage(now(), UTILITY_SNAPSHOT_STALE_MS)
    const ai: NonNullable<UtilityPayload["ai"]> = {
      fiveHourPct: usage.fiveHourPct,
      fiveHourResetAt: usage.fiveHourResetAt,
      sevenDayPct: usage.sevenDayPct,
      sevenDayResetAt: usage.sevenDayResetAt,
      ctxPct: usage.ctxPct,
      ctxSize: usage.ctxSize,
      costUsd: usage.costUsd,
      cachePct: usage.cachePct,
      model: usage.model,
      effort: usage.effort,
      linesAdded: usage.linesAdded,
      linesRemoved: usage.linesRemoved,
      burnUsdPerMin: derived.burnUsdPerMin,
      timeToLimitMin: derived.timeToLimitMin,
    }
    return ai
  }

  return {
    build() {
      const t = now()
      const usage = readUsageSnapshot(t, UTILITY_SNAPSHOT_STALE_MS)

      // kick stale probes off in the background; use whatever's cached now.
      refresh(machineCell, UTILITY_MACHINE_CACHE_MS, () => probeMachine(usage?.cwd))
      refresh(healthCell, UTILITY_HEALTH_CACHE_MS, () => probeHealth(now))
      if (usage?.cwd) {
        const cwd = usage.cwd
        refresh(gitCell, UTILITY_GIT_CACHE_MS, () => probeGit(cwd, t))
      }

      const ai = aiFrom(usage)
      const git = gitCell.value ?? undefined
      const machine = machineCell.value ?? undefined
      const health = healthCell.value ?? undefined

      // nothing useful yet (cold start, no Claude session) — skip this rotation.
      if (!ai && !git && !machine && !health) return null

      const payload: UtilityPayload = {
        kind: "utility",
        generatedAt: t,
        layout: resolveLayout(),
        ...(ai ? { ai } : {}),
        ...(git ? { git } : {}),
        ...(machine ? { machine } : {}),
        ...(health ? { health } : {}),
      }
      return { ...payload, cacheSource: "local" }
    },
  }
}
