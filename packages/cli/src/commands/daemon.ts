import { spawn } from "node:child_process"
import { closeSync, openSync, unwatchFile, watchFile } from "node:fs"
import { createConnection } from "node:net"
import { platform } from "node:os"
import { Command } from "commander"
import { configPath, readConfig, writeConfig } from "../lib/config.js"
import { openAdCache } from "../lib/ad-cache.js"
import { openLedger } from "../lib/ledger.js"
import { showAd } from "../lib/daemon/display.js"
import { createKeyCapture } from "../lib/daemon/input.js"
import {
  acquireSingletonLock,
  appendLog,
  HEARTBEAT_STALE_AFTER_MS,
  isSocketAlive,
  logPath,
  readDaemonStatus,
  readHeartbeat,
  removeHeartbeat,
  removeLockFile,
  resolveSocketPath,
  unlinkSocketIfExists,
  writeHeartbeat,
  type Heartbeat,
} from "../lib/daemon/lifecycle.js"
import { createOrchestrator } from "../lib/daemon/orchestrator.js"
import { startDaemonServer } from "../lib/daemon/server.js"
import { createSyncLoop } from "../lib/daemon/sync.js"

const HEARTBEAT_INTERVAL_MS = 10_000
const START_POLL_DEADLINE_MS = 2_000

export async function runStart(): Promise<number> {
  const cfg = await readConfig()
  if (!cfg || !cfg.user?.id || !cfg.device?.id) {
    console.error("not initialized — run `devdrip init` first")
    return 1
  }
  if (!cfg.cli?.binPath) {
    console.error("cli.binPath missing from config — run `devdrip init` again")
    return 1
  }

  const socketPath = resolveSocketPath()
  if (await isSocketAlive(socketPath)) {
    const hb = readHeartbeat()
    console.log(`daemon already running (pid ${hb?.pid ?? "?"})`)
    return 0
  }
  unlinkSocketIfExists(socketPath)

  // drop any stale heartbeat so the poll below can't accidentally trust it.
  removeHeartbeat()

  const logFd = openSync(logPath(), "a", 0o600)
  const child = spawn(cfg.cli.binPath, ["daemon", "run"], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: process.env,
  })
  child.unref()
  // the child inherited its own fd copy; the parent's can be closed.
  try {
    closeSync(logFd)
  } catch {
    /* ignore */
  }

  const deadline = Date.now() + START_POLL_DEADLINE_MS
  while (Date.now() < deadline) {
    const hb = readHeartbeat()
    if (hb && hb.pid === child.pid && Date.now() - hb.lastHeartbeat < HEARTBEAT_STALE_AFTER_MS) {
      console.log(`daemon started (pid ${hb.pid}, socket ${hb.socketPath})`)
      return 0
    }
    if (child.exitCode !== null) {
      console.error(
        `daemon crashed on startup (exit code ${child.exitCode}) — check ~/.devdrip/daemon.log`
      )
      return 1
    }
    await sleep(50)
  }
  console.error("daemon did not write heartbeat within 2s — check ~/.devdrip/daemon.log")
  return 1
}

export async function runStop(): Promise<number> {
  const hb = readHeartbeat()
  if (!hb) {
    console.log("daemon not running")
    return 0
  }
  // send kill over the socket
  await sendKill(hb.socketPath)

  const deadline = Date.now() + 1000
  while (Date.now() < deadline) {
    if (!readHeartbeat()) {
      console.log("daemon stopped")
      return 0
    }
    await sleep(50)
  }

  // SIGTERM fallback
  try {
    process.kill(hb.pid, "SIGTERM")
  } catch {
    /* already dead */
  }
  await sleep(500)
  if (!readHeartbeat()) {
    console.log("daemon stopped (via SIGTERM)")
    return 0
  }

  try {
    process.kill(hb.pid, "SIGKILL")
  } catch {
    /* ignore */
  }
  // SIGKILL skips the daemon's shutdown handler, so clean up the state files
  // ourselves. Brief sleep lets the kernel reap the process before we unlink.
  await sleep(100)
  removeHeartbeat()
  unlinkSocketIfExists(hb.socketPath)
  removeLockFile()
  console.warn("daemon force-killed")
  return 0
}

export async function runStatus(): Promise<string> {
  const status = readDaemonStatus()
  const lines: string[] = []
  if (status.health === "not-running") {
    return "daemon:    not running"
  }
  if (status.health === "stale") {
    const ageSec = Math.round((status.lastHeartbeatAgeMs ?? 0) / 1000)
    lines.push(`daemon:    stale (last heartbeat ${ageSec}s ago, pid=${status.pid})`)
  } else {
    const uptimeSec = Math.round((status.uptimeMs ?? 0) / 1000)
    lines.push(
      `daemon:    running (pid=${status.pid}, uptime=${uptimeSec}s, socket=${status.socketPath})`
    )
  }
  // unsynced count (best-effort; doesn't create the ledger if absent)
  try {
    const ledger = openLedger()
    try {
      lines.push(`unsynced:  ${ledger.unsyncedCount()}`)
    } finally {
      ledger.close()
    }
  } catch {
    /* ignore */
  }
  lines.push(`hooks:     ${status.hooksReceivedThisSession} received this session`)
  lines.push(`ads shown: ${status.adsShownThisSession}`)
  return lines.join("\n")
}

export async function runDaemon(): Promise<number> {
  const cfg = await readConfig()
  if (!cfg || !cfg.user?.id || !cfg.device?.id) {
    appendLog("error", "daemon run: not initialized")
    return 1
  }

  const lock = acquireSingletonLock()
  if (!lock) {
    appendLog("error", "daemon run: lock held by another process")
    return 1
  }

  const socketPath = resolveSocketPath()
  unlinkSocketIfExists(socketPath)

  const ledger = openLedger()
  const adCache = openAdCache({
    userId: cfg.user.id,
    deviceId: cfg.device.id,
    surface: "terminal-tv",
  })

  const log = {
    debug: (msg: string, fields?: Record<string, unknown>) => appendLog("debug", msg, fields),
    info: (msg: string, fields?: Record<string, unknown>) => appendLog("info", msg, fields),
    warn: (msg: string, fields?: Record<string, unknown>) => appendLog("warn", msg, fields),
    error: (msg: string, fields?: Record<string, unknown>) => appendLog("error", msg, fields),
  }

  const syncLoop = createSyncLoop({ ledger, log })
  syncLoop.start()

  // forward declaration: keyCapture.onKey closes over orchestrator, but
  // orchestrator needs keyCapture passed into createOrchestrator. keys can
  // only arrive after createOrchestrator returns, so the hoist is safe.
  // eslint-disable-next-line prefer-const
  let orchestrator: ReturnType<typeof createOrchestrator>

  const keyCapture = createKeyCapture({
    onKey: (action) => {
      const now = Date.now()
      switch (action) {
        case "discover":
          orchestrator.dispatch({ kind: "discover-key", now })
          return
        case "skip":
          orchestrator.dispatch({ kind: "skip-key", now })
          return
        case "kill":
          orchestrator.dispatch({ kind: "kill-key", now })
          return
        case "mute":
          orchestrator.dispatch({ kind: "mute-key", now })
          return
        case "dismiss":
          orchestrator.dispatch({ kind: "dismiss", now })
          return
      }
    },
    log,
  })

  const openUrl = (url: string): void => {
    const cmd = platform() === "darwin" ? "open" : platform() === "win32" ? "start" : "xdg-open"
    try {
      const child = spawn(cmd, [url], { detached: true, stdio: "ignore" })
      child.unref()
    } catch (err) {
      log.warn("openUrl spawn failed", { url, error: (err as Error).message })
    }
  }

  const fireBeacon = (url: string): void => {
    fetch(url, { method: "GET" }).catch(() => {})
  }

  const writePreferencesFn = async (next: typeof cfg.preferences): Promise<void> => {
    const current = await readConfig()
    if (!current) return
    await writeConfig({ ...current, preferences: next })
  }

  orchestrator = createOrchestrator({
    adCache,
    ledger,
    display: { show: showAd },
    keyCapture,
    openUrl,
    fireBeacon,
    writePreferences: writePreferencesFn,
    log,
    deviceId: cfg.device.id,
    preferences: cfg.preferences,
  })

  let lastCategoriesFingerprint = cfg.preferences.blockedCategories.slice().sort().join(",")

  async function reloadPreferences(source: "socket" | "file"): Promise<void> {
    try {
      const next = await readConfig()
      if (!next) return
      orchestrator.updatePreferences(next.preferences)
      const nextFp = next.preferences.blockedCategories.slice().sort().join(",")
      if (nextFp !== lastCategoriesFingerprint) {
        lastCategoriesFingerprint = nextFp
        // blocked categories changed — the existing cache may still contain
        // now-blocked ads. Force a refresh so the next display reflects the
        // new blocklist (backend applies the server-side filter on fetch).
        adCache.refreshNow().catch((err: Error) => {
          log.warn("ad-cache refresh after preference change failed", {
            error: err.message,
          })
        })
      }
      log.info("config reloaded", { source })
    } catch (err) {
      log.warn("config reload failed", { error: (err as Error).message })
    }
  }

  const started: Heartbeat = {
    version: 1,
    pid: process.pid,
    startedAt: Date.now(),
    lastHeartbeat: Date.now(),
    socketPath,
    adsShownThisSession: 0,
    hooksReceivedThisSession: 0,
  }

  const server = await startDaemonServer({
    socketPath,
    dispatch: (ev) => orchestrator.dispatch(ev),
    onKill: () => {
      void shutdown()
    },
    onReloadConfig: () => {
      void reloadPreferences("socket")
    },
    log,
  })

  log.info("daemon started", { pid: process.pid, socket: socketPath })
  writeHeartbeat(started)

  const heartbeatInterval = setInterval(() => {
    writeHeartbeat({
      ...started,
      lastHeartbeat: Date.now(),
      adsShownThisSession: orchestrator.adsShown(),
      hooksReceivedThisSession: orchestrator.hooksReceived(),
    })
  }, HEARTBEAT_INTERVAL_MS)

  // Poll-based watcher — fs.watch on macOS intermittently misses
  // atomic rename-in-place writes from writeConfig(); watchFile polling at
  // 1s is dull but reliable at MVP scale.
  const watchedConfig = configPath()
  watchFile(watchedConfig, { interval: 1000 }, (curr, prev) => {
    if (curr.mtimeMs === prev.mtimeMs) return
    void reloadPreferences("file")
  })

  let shuttingDown = false
  async function shutdown(): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    clearInterval(heartbeatInterval)
    unwatchFile(watchedConfig)
    await syncLoop.stop()
    await orchestrator.shutdown()
    await server.close()
    unlinkSocketIfExists(socketPath)
    ledger.close()
    adCache.close()
    removeHeartbeat()
    lock?.release()
    log.info("daemon stopped")
    process.exit(0)
  }

  process.on("SIGTERM", () => void shutdown())
  process.on("SIGINT", () => void shutdown())

  return new Promise(() => {
    /* run forever until shutdown() exits the process */
  })
}

async function sendKill(socketPath: string): Promise<void> {
  return new Promise((resolve) => {
    const sock = createConnection(socketPath)
    sock.setTimeout(200)
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      resolve()
    }
    sock.on("connect", () => sock.end(JSON.stringify({ type: "kill", ts: Date.now() }) + "\n"))
    sock.on("close", done)
    sock.on("timeout", () => {
      sock.destroy()
      done()
    })
    sock.on("error", done)
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export const daemonCmd = new Command("daemon")
  .description("manage the background daemon process")
  .addCommand(
    new Command("start").description("start the background daemon").action(async () => {
      process.exit(await runStart())
    })
  )
  .addCommand(
    new Command("stop").description("stop the background daemon").action(async () => {
      process.exit(await runStop())
    })
  )
  .addCommand(
    new Command("status").description("show daemon status").action(async () => {
      console.log(await runStatus())
    })
  )
  .addCommand(
    new Command("run")
      .description("run the daemon in the foreground (used internally by `start`)")
      .action(async () => {
        const code = await runDaemon()
        process.exit(code)
      })
  )
