import { existsSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { Command } from "commander"
import { reportError } from "../lib/api-client.js"
import { readConfig, type DevdripConfig } from "../lib/config.js"
import { readDaemonStatus, type DaemonStatus } from "../lib/daemon/lifecycle.js"
import { ledgerPath, openLedger } from "../lib/ledger.js"
import { slotCachePath } from "../lib/slot-cache.js"
import { maybeCheck } from "../lib/upgrade-check.js"

const require = createRequire(import.meta.url)

interface SlotCacheInfo {
  count: number
  ageMs: number | null
  expiresAt: number | null
}

interface StatusPayload {
  installed: boolean
  mode: string | null
  channels: string[]
  daemon: DaemonStatus
  slotCache: SlotCacheInfo
  unsyncedImpressions: number
  offline: boolean
}

export const statusCmd = new Command("status")
  .description("show daemon, slot cache, and sync status")
  .option("--json", "emit a single JSON object (stable shape for scripting)")
  .option("--local", "skip backend call; show local state only")
  .action(async (opts: { json?: boolean; local?: boolean }) => {
    try {
      const cfg = await readConfig()
      const daemon = readDaemonStatus()
      const slotCache = readSlotCacheInfo()
      const unsynced = readUnsyncedCount()

      const upgradePromise = opts.json ? Promise.resolve(null) : runPassiveUpgradeCheck()

      const payload: StatusPayload = {
        installed: cfg !== null,
        mode: cfg?.preferences.channelMode ?? null,
        channels: resolveChannels(cfg),
        daemon,
        slotCache,
        unsyncedImpressions: unsynced,
        offline: opts.local ?? false,
      }

      if (opts.json) {
        process.stdout.write(`${JSON.stringify(payload)}\n`)
        return
      }
      printHuman(payload)

      const upgrade = await upgradePromise
      if (upgrade?.outdated) {
        console.log(`upgrade:  ${upgrade.latest} available (run \`distro upgrade\`)`)
      }
    } catch (err) {
      reportError(err)
    }
  })

async function runPassiveUpgradeCheck(): Promise<{ latest: string; outdated: boolean } | null> {
  try {
    const { version = "0.0.0" } = require("../package.json") as { version?: string }
    return await maybeCheck(version, { timeoutMs: 500 })
  } catch {
    return null
  }
}

function readSlotCacheInfo(): SlotCacheInfo {
  try {
    const raw = readFileSync(slotCachePath(), "utf8")
    const parsed = JSON.parse(raw) as {
      version?: number
      slots?: unknown[]
      fetchedAt?: number
      expiresAt?: number
    }
    const count = Array.isArray(parsed.slots) ? parsed.slots.length : 0
    const fetchedAt = typeof parsed.fetchedAt === "number" ? parsed.fetchedAt : null
    const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : null
    const ageMs = fetchedAt !== null ? Date.now() - fetchedAt : null
    return { count, ageMs, expiresAt }
  } catch {
    return { count: 0, ageMs: null, expiresAt: null }
  }
}

function readUnsyncedCount(): number {
  if (!existsSync(ledgerPath())) return 0
  const ledger = openLedger()
  try {
    return ledger.unsyncedCount()
  } finally {
    ledger.close()
  }
}

function resolveChannels(cfg: DevdripConfig | null): string[] {
  if (!cfg) return []
  const mode = cfg.preferences.channelMode
  if (mode === "markets") return ["markets"]
  if (mode === "news") return ["news"]
  // mix or default
  return ["news", "markets"]
}

function formatUptime(ms: number): string {
  const totalSec = Math.max(0, Math.round(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function formatAge(ms: number): string {
  const mins = Math.round(ms / 60_000)
  if (mins < 1) return "<1 min ago"
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  return `${hours}h ago`
}

function printHuman(p: StatusPayload): void {
  if (!p.installed) {
    console.log("distro:   not initialized (run `distro init`)")
    printDaemon(p.daemon)
    return
  }

  console.log(`mode:     ${p.mode ?? "unknown"}`)
  console.log(`channels: ${p.channels.length > 0 ? p.channels.join(", ") : "none"}`)
  console.log(`watchlist: (lands in M4)`)

  printSlotCache(p.slotCache)
  printDaemon(p.daemon)

  if (p.unsyncedImpressions > 0) {
    console.log(`unsynced: ${p.unsyncedImpressions} impressions`)
  }
}

function printSlotCache(c: SlotCacheInfo): void {
  const age = c.ageMs !== null ? formatAge(c.ageMs) : "never"
  const expired = c.expiresAt !== null && c.expiresAt < Date.now() ? " (expired)" : ""
  console.log(`slot cache: ${c.count} slots, fetched ${age}${expired}`)
}

function printDaemon(d: DaemonStatus): void {
  if (d.health === "not-running") {
    console.log("daemon:   stopped (run `distro daemon start`)")
    return
  }
  if (d.health === "stale") {
    const ageSec = Math.round((d.lastHeartbeatAgeMs ?? 0) / 1000)
    console.log(`daemon:   stale (heartbeat ${ageSec}s ago, pid ${d.pid})`)
    return
  }
  console.log(`daemon:   running (uptime ${formatUptime(d.uptimeMs ?? 0)}, pid ${d.pid})`)
}

export type { StatusPayload }
