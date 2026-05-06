import { access, readFile, statfs } from "node:fs/promises"
import { platform } from "node:os"
import { apiFetch, apiFetchPublic, resolveApiUrl } from "./api-client.js"
import { slotCachePath } from "./slot-cache.js"
import { getMissingDevdripHookEvents, readSettings } from "./claude-settings.js"
import { configDir, type DevdripConfig } from "./config.js"
import { readDaemonStatus } from "./daemon/lifecycle.js"

export interface Probe {
  name: string
  ok: boolean
  detail: string
  // remediation hint shown on failure (and only on failure). undefined for
  // probes we don't have a clean fix command for.
  fix?: string
}

const PROBE_TIMEOUT_MS = 500
const DAEMON_HEARTBEAT_FRESH_MS = 20_000
const LEDGER_DISK_FAIL_BYTES = 10 * 1024 * 1024
const LEDGER_DISK_WARN_BYTES = 100 * 1024 * 1024

async function probeAuth(): Promise<Probe> {
  try {
    await apiFetch<unknown>("/me", { timeoutMs: PROBE_TIMEOUT_MS })
    return { name: "auth valid (GET /me)", ok: true, detail: "" }
  } catch (err) {
    return {
      name: "auth valid (GET /me)",
      ok: false,
      detail: errDetail(err),
      fix: "run `distro auth`",
    }
  }
}

async function probeDevice(cfg: DevdripConfig): Promise<Probe> {
  const id = cfg.device?.id
  if (!id) {
    return {
      name: "device registered",
      ok: false,
      detail: "no device.id in config",
      fix: "run `distro init`",
    }
  }
  return { name: "device registered", ok: true, detail: `id: ${id.slice(0, 8)}…` }
}

async function probeHooks(settingsPath: string, binPath: string): Promise<Probe> {
  try {
    const s = await readSettings(settingsPath)
    const missing = getMissingDevdripHookEvents(s, binPath)
    return {
      name: "hooks installed in ~/.claude/settings.json",
      ok: missing.length === 0,
      detail:
        missing.length === 0
          ? ""
          : binPath.length === 0
            ? "no cli.binPath in config"
            : `missing events: ${missing.join(", ")}`,
      ...(missing.length === 0 ? {} : { fix: "run `distro init`" }),
    }
  } catch (err) {
    return {
      name: "hooks installed in ~/.claude/settings.json",
      ok: false,
      detail: errDetail(err),
      fix: "run `distro init`",
    }
  }
}

async function probeBackend(): Promise<Probe> {
  try {
    await apiFetchPublic<unknown>("/health", { timeoutMs: PROBE_TIMEOUT_MS })
    return { name: "backend reachable (GET /health)", ok: true, detail: "" }
  } catch (err) {
    return {
      name: "backend reachable (GET /health)",
      ok: false,
      detail: errDetail(err),
      fix: "check network / api url in config",
    }
  }
}

async function probeDaemon(): Promise<Probe> {
  const s = readDaemonStatus()
  if (s.health === "not-running") {
    return {
      name: "daemon running",
      ok: false,
      detail: "not running",
      fix: "run `distro daemon start`",
    }
  }
  const age = s.lastHeartbeatAgeMs ?? 0
  if (s.health === "stale" || age > DAEMON_HEARTBEAT_FRESH_MS) {
    const ageSec = Math.round(age / 1000)
    return {
      name: "daemon running",
      ok: false,
      detail: `stale heartbeat (${ageSec}s ago, pid ${s.pid ?? "?"})`,
      fix: "run `distro daemon stop && distro daemon start`",
    }
  }
  return {
    name: "daemon running",
    ok: true,
    detail: `pid ${s.pid}, heartbeat ${Math.round(age / 1000)}s ago`,
  }
}

interface SlotCacheSnapshot {
  expiresAt?: number
  slots?: unknown[]
}

async function probeSlotCache(now: number = Date.now()): Promise<Probe> {
  try {
    const raw = await readFile(slotCachePath(), "utf8")
    const parsed = JSON.parse(raw) as SlotCacheSnapshot
    const count = Array.isArray(parsed.slots) ? parsed.slots.length : 0
    const expiresAt = typeof parsed.expiresAt === "number" ? parsed.expiresAt : 0
    if (count === 0) {
      return {
        name: "slot cache populated",
        ok: false,
        detail: "0 slots cached",
        fix: "run `distro daemon start` to warm the cache",
      }
    }
    if (expiresAt <= now) {
      const stalenessSec = Math.round((now - expiresAt) / 1000)
      return {
        name: "slot cache populated",
        ok: false,
        detail: `expired ${stalenessSec}s ago (${count} slots)`,
        fix: "daemon refreshes automatically — check network",
      }
    }
    return { name: "slot cache populated", ok: true, detail: `${count} slots cached` }
  } catch (err) {
    if (isNotFound(err)) {
      return {
        name: "slot cache populated",
        ok: false,
        detail: "cache file missing",
        fix: "run `distro daemon start` to warm the cache",
      }
    }
    return {
      name: "slot cache populated",
      ok: false,
      detail: errDetail(err),
      fix: "inspect ~/.distro/slot-cache.json",
    }
  }
}

async function probeTty(): Promise<Probe> {
  if (process.platform === "win32") {
    // /dev/tty doesn't exist on Windows; stdout.isTTY alone is the signal.
    const ok = !!process.stdout.isTTY
    return {
      name: "tty writable",
      ok,
      detail: ok ? "(win32 stdout)" : "no tty",
      ...(ok ? {} : { fix: "run in an interactive terminal" }),
    }
  }
  if (!process.stdout.isTTY) {
    return {
      name: "tty writable",
      ok: false,
      detail: "stdout is not a tty",
      fix: "run in an interactive terminal",
    }
  }
  try {
    // just confirm we can open /dev/tty — don't hold the handle. node will
    // close fd's when the program exits anyway, but access() avoids spinning
    // up a ReadStream we'd have to destroy.
    await access("/dev/tty")
    return { name: "tty writable", ok: true, detail: "/dev/tty" }
  } catch (err) {
    return {
      name: "tty writable",
      ok: false,
      detail: errDetail(err),
      fix: "run in an interactive terminal",
    }
  }
}

async function probeLedgerDisk(): Promise<Probe> {
  try {
    const stats = await statfs(configDir())
    const bavail = Number(stats.bavail)
    const bsize = Number(stats.bsize)
    const availBytes = bavail * bsize
    const availMb = Math.round(availBytes / (1024 * 1024))
    if (availBytes < LEDGER_DISK_FAIL_BYTES) {
      return {
        name: "disk space for ledger",
        ok: false,
        detail: `only ${availMb} MB free on ~/.distro partition`,
        fix: "free up disk space",
      }
    }
    if (availBytes < LEDGER_DISK_WARN_BYTES) {
      // Surface as warn-but-ok: the probe reports ok=true (doctor's exit code
      // stays 0) but the detail carries the warn signal so the human output
      // can style it yellow. Under 10 MB flips to fail above.
      return {
        name: "disk space for ledger",
        ok: true,
        detail: `warn: only ${availMb} MB free`,
      }
    }
    return { name: "disk space for ledger", ok: true, detail: `${availMb} MB free` }
  } catch (err) {
    // Windows + older libuv builds return ENOSYS / EINVAL on statfs. Don't
    // fail doctor for a platform limitation — report "unknown" as ok.
    return { name: "disk space for ledger", ok: true, detail: `unknown (${errDetail(err)})` }
  }
}

export async function runInitHealthCheck(
  cfg: DevdripConfig,
  settingsPath: string
): Promise<Probe[]> {
  const binPath = cfg.cli?.binPath ?? ""
  const [auth, device, hooks, backend] = await Promise.all([
    probeAuth(),
    probeDevice(cfg),
    probeHooks(settingsPath, binPath),
    probeBackend(),
  ])
  return [auth, device, hooks, backend]
}

// Doctor adds four probes on top of the init set. Results are returned in a
// fixed order (auth, device, hooks, backend, daemon, slot-cache, tty, disk)
// regardless of how they resolved, so the human output is deterministic and
// the --json shape is stable across runs.
export async function runDoctorHealthCheck(
  cfg: DevdripConfig,
  settingsPath: string
): Promise<Probe[]> {
  const binPath = cfg.cli?.binPath ?? ""
  const [auth, device, hooks, backend, daemon, slotCache, tty, disk] = await Promise.all([
    probeAuth(),
    probeDevice(cfg),
    probeHooks(settingsPath, binPath),
    probeBackend(),
    probeDaemon(),
    probeSlotCache(),
    probeTty(),
    probeLedgerDisk(),
  ])
  return [auth, device, hooks, backend, daemon, slotCache, tty, disk]
}

function errDetail(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "ENOENT"
  )
}

// resolveApiUrl is imported only so the mock surface in tests matches reality
export { resolveApiUrl }
// re-export platform so tests can mock it (vi.mock("os") is cleaner at the import site)
export { platform }
