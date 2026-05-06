import { existsSync } from "node:fs"
import { createRequire } from "node:module"
import { Command } from "commander"
import { MIN_PAYOUT_USDC } from "@distrotv/shared"
import {
  ApiError,
  apiFetch,
  type MeResponse,
  NotAuthenticatedError,
  reportError,
} from "../lib/api-client.js"
import { readConfig, type DevdripConfig } from "../lib/config.js"
import { readDaemonStatus, type DaemonStatus } from "../lib/daemon/lifecycle.js"
import { ledgerPath, openLedger } from "../lib/ledger.js"
import {
  readStatusCache,
  writeStatusCache,
  type CachedEarningsSummary,
} from "../lib/status-cache.js"
import { maybeCheck } from "../lib/upgrade-check.js"

const require = createRequire(import.meta.url)

// Mirrors the backend `EarningsSummary` shape (packages/api/src/services/earnings.service.ts).
// Re-declared locally so this command doesn't take a dependency on the API package.
interface EarningsSummaryResponse {
  balance: number
  today: number
  week: number
  month: number
  allTime: number
  streakDays: number
  totalImpressions: number
  totalClicks: number
  topCategories: { category: string; amountUsdc: number }[]
}

interface LocalLedgerState {
  unsyncedImpressions: number
  unsyncedClicks: number
  todayOptimistic: number
}

interface StatusUser {
  githubLogin: string | null
  email: string
  // World identity fields (populated from /me response when signed in; null
  // until Mini App signup completes).
  walletAddress: string | null
  verificationLevel: "device" | "orb" | null
  signedUpAt: string | null
  miniAppComplete: boolean
}

interface StatusPayload {
  user: StatusUser | null
  earnings: EarningsSummaryResponse | null
  earningsFromCache: boolean
  earningsCacheAgeMs: number | null
  payout: { eligible: boolean; threshold: number; shortfall: number } | null
  unsynced: { impressions: number; clicks: number }
  localTodayOptimistic: number
  daemon: DaemonStatus
  offline: boolean
  offlineReason: string | null
}

export const statusCmd = new Command("status")
  .description("show earnings, daemon, and sync status")
  .option("--json", "emit a single JSON object (stable shape for scripting)")
  .option("--local", "skip backend call; show local ledger + daemon only")
  .action(async (opts: { json?: boolean; local?: boolean }) => {
    try {
      const cfg = await readConfig()
      // use the persisted preference tz when signed in (matches the daemon +
      // earnings toast + config layer). fall back to the host tz only for the
      // not-signed-in path, where no preference exists yet.
      const tzOffsetMinutes = cfg?.preferences.tzOffsetMinutes ?? -new Date().getTimezoneOffset()
      const ledger = readLocalLedger(tzOffsetMinutes)
      const daemon = readDaemonStatus()

      // passive upgrade check — 500ms cap, errors swallowed, never gates the
      // main flow. --json skips it so scripts see a stable shape.
      const upgradePromise = opts.json ? Promise.resolve(null) : runPassiveUpgradeCheck()

      const { earnings, earningsFromCache, earningsCacheAgeMs, offline, offlineReason } =
        await fetchEarnings(cfg, opts.local ?? false)

      // Fetch /me only when signed in + online — the new World identity fields
      // (walletAddress, verificationLevel, signedUpAt) live there. On failure
      // fall back to the cached config user fields (no World identity in that path).
      const me = cfg && !opts.local ? await fetchMeSafe() : null

      const user: StatusUser | null = cfg
        ? {
            githubLogin: me?.githubLogin ?? cfg.user.githubLogin ?? null,
            email: me?.email ?? cfg.user.email,
            walletAddress: me?.walletAddress ?? null,
            verificationLevel: me?.verificationLevel ?? null,
            signedUpAt: me?.signedUpAt ?? null,
            miniAppComplete: !!me?.signedUpAt,
          }
        : null

      const payload: StatusPayload = {
        user,
        earnings,
        earningsFromCache,
        earningsCacheAgeMs,
        payout: computePayout(earnings),
        unsynced: { impressions: ledger.unsyncedImpressions, clicks: ledger.unsyncedClicks },
        localTodayOptimistic: ledger.todayOptimistic,
        daemon,
        offline,
        offlineReason,
      }

      if (opts.json) {
        process.stdout.write(`${JSON.stringify(payload)}\n`)
        return
      }
      printHuman(payload)
      const upgrade = await upgradePromise
      if (upgrade?.outdated) {
        console.log(`upgrade:  ${upgrade.latest} available (run \`devdrip upgrade\`)`)
      }
    } catch (err) {
      reportError(err)
    }
  })

// Passive check for `status`: 500 ms budget, cached result preferred, any
// error = silent null. The main status output never waits on this beyond
// the half-second.
async function runPassiveUpgradeCheck(): Promise<{ latest: string; outdated: boolean } | null> {
  try {
    // path relative to the bundled dist/index.js, matching src/index.ts
    const { version = "0.0.0" } = require("../package.json") as { version?: string }
    const result = await maybeCheck(version, { timeoutMs: 500 })
    return result
  } catch {
    return null
  }
}

function readLocalLedger(tzOffsetMinutes: number): LocalLedgerState {
  // ledger file is created lazily on first impression write. avoid creating it
  // just to read zeroes — that would leave an empty ledger.db for dev boxes
  // that have never seen an ad.
  if (!existsSync(ledgerPath())) {
    return { unsyncedImpressions: 0, unsyncedClicks: 0, todayOptimistic: 0 }
  }
  const ledger = openLedger()
  try {
    return {
      unsyncedImpressions: ledger.unsyncedCount(),
      unsyncedClicks: ledger.unsyncedClickCount(),
      todayOptimistic: ledger.sumTodayOptimistic(tzOffsetMinutes),
    }
  } finally {
    ledger.close()
  }
}

interface FetchResult {
  earnings: EarningsSummaryResponse | null
  earningsFromCache: boolean
  earningsCacheAgeMs: number | null
  offline: boolean
  offlineReason: string | null
}

async function fetchMeSafe(): Promise<MeResponse | null> {
  try {
    return await apiFetch<MeResponse>("/me")
  } catch {
    // /me failure is non-fatal here — the earnings fetch already gates the
    // online/offline narrative; the World identity section just gets skipped.
    return null
  }
}

async function fetchEarnings(cfg: DevdripConfig | null, localOnly: boolean): Promise<FetchResult> {
  if (!cfg) {
    return {
      earnings: null,
      earningsFromCache: false,
      earningsCacheAgeMs: null,
      offline: false,
      offlineReason: "not-signed-in",
    }
  }
  if (localOnly) {
    return {
      earnings: null,
      earningsFromCache: false,
      earningsCacheAgeMs: null,
      offline: true,
      offlineReason: "local-only",
    }
  }
  try {
    const fresh = await apiFetch<EarningsSummaryResponse>("/me/earnings/summary")
    writeStatusCache(fresh as CachedEarningsSummary)
    return {
      earnings: fresh,
      earningsFromCache: false,
      earningsCacheAgeMs: null,
      offline: false,
      offlineReason: null,
    }
  } catch (err) {
    // expired auth surfaces through the normal reportError path; retries won't help here.
    if (err instanceof NotAuthenticatedError) throw err
    const reason = err instanceof ApiError ? `api ${err.status}` : "network"
    const cached = readStatusCache()
    return {
      earnings: cached?.summary ?? null,
      earningsFromCache: cached !== null,
      earningsCacheAgeMs: cached?.ageMs ?? null,
      offline: true,
      offlineReason: reason,
    }
  }
}

function computePayout(earnings: EarningsSummaryResponse | null): StatusPayload["payout"] {
  if (!earnings) return null
  const threshold = MIN_PAYOUT_USDC
  const eligible = earnings.balance >= threshold
  const shortfall = eligible ? 0 : Math.max(0, threshold - earnings.balance)
  return { eligible, threshold, shortfall }
}

function formatUsdc(n: number): string {
  return `$${n.toFixed(2)}`
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

function printHuman(p: StatusPayload): void {
  if (!p.user) {
    console.log("auth:     not signed in (run `devdrip auth`)")
    // still show daemon + unsynced even when not signed in — useful for support
    printDaemon(p.daemon)
    printUnsynced(p.unsynced)
    return
  }

  const handle = p.user.githubLogin ? `@${p.user.githubLogin}` : p.user.email
  console.log(`user:     ${handle} (${p.user.email})`)
  printWorldIdentity(p.user)

  if (p.earnings) {
    const e = p.earnings
    const marker = p.earningsFromCache ? ` (cached, ${formatCacheAge(p.earningsCacheAgeMs)})` : ""
    console.log(
      `earnings: ${formatUsdc(e.today)} today · ${formatUsdc(e.week)} week · ${formatUsdc(e.month)} month${marker}`
    )
    console.log(`streak:   ${e.streakDays} day${e.streakDays === 1 ? "" : "s"}`)
    if (p.payout) {
      const payoutLine = p.payout.eligible
        ? `balance:  ${formatUsdc(e.balance)} → payout eligible (min ${formatUsdc(p.payout.threshold)})`
        : `balance:  ${formatUsdc(e.balance)} → needs ${formatUsdc(p.payout.shortfall)} more to claim`
      console.log(payoutLine)
    }
  } else {
    // no earnings data — could be offline with no cache, or --local
    const reason = p.offlineReason ?? "unavailable"
    console.log(
      `earnings: unavailable (${reason}) · local today ≈ ${formatUsdc(p.localTodayOptimistic)}`
    )
  }

  printUnsynced(p.unsynced)
  printDaemon(p.daemon)

  if (p.offline && p.earningsFromCache) {
    console.log(`offline:  backend unreachable (${p.offlineReason}) — showing cached earnings`)
  } else if (p.offline && p.offlineReason !== "local-only") {
    console.log(`offline:  backend unreachable (${p.offlineReason})`)
  }
}

function printWorldIdentity(u: StatusUser): void {
  const wallet = u.walletAddress
    ? `${u.walletAddress.slice(0, 6)}…${u.walletAddress.slice(-4)}`
    : "not bound"
  const worldId = u.verificationLevel ?? "not verified"
  const miniApp = u.miniAppComplete ? "complete" : "incomplete"
  console.log(`wallet:   ${wallet}`)
  console.log(`world id: ${worldId}`)
  console.log(`mini app: ${miniApp}`)
}

function printUnsynced(u: StatusPayload["unsynced"]): void {
  if (u.impressions === 0 && u.clicks === 0) {
    console.log("unsynced: 0 impressions, 0 clicks")
  } else {
    console.log(`unsynced: ${u.impressions} impressions, ${u.clicks} clicks`)
  }
}

function printDaemon(d: DaemonStatus): void {
  if (d.health === "not-running") {
    console.log("daemon:   stopped (run `devdrip daemon start`)")
    return
  }
  if (d.health === "stale") {
    const ageSec = Math.round((d.lastHeartbeatAgeMs ?? 0) / 1000)
    console.log(`daemon:   stale (heartbeat ${ageSec}s ago, pid ${d.pid})`)
    return
  }
  console.log(`daemon:   running (uptime ${formatUptime(d.uptimeMs ?? 0)}, pid ${d.pid})`)
}

function formatCacheAge(ageMs: number | null): string {
  if (ageMs === null) return "cached"
  const mins = Math.round(ageMs / 60_000)
  if (mins < 1) return "<1 min old"
  if (mins < 60) return `${mins} min old`
  const hours = Math.round(mins / 60)
  return `${hours}h old`
}

export type { StatusPayload }
