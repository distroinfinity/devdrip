import { spawn } from "node:child_process"
import { openSync } from "node:fs"
import { createConnection } from "node:net"
import { Command } from "commander"
import { readConfig } from "../lib/config.js"
import { openAdCache } from "../lib/ad-cache.js"
import { openLedger } from "../lib/ledger.js"
import { showAd } from "../lib/daemon/display.js"
import {
  acquireSingletonLock,
  appendLog,
  isSocketAlive,
  logPath,
  readHeartbeat,
  removeHeartbeat,
  resolveSocketPath,
  unlinkSocketIfExists,
  writeHeartbeat,
  type Heartbeat,
} from "../lib/daemon/lifecycle.js"
import { createOrchestrator } from "../lib/daemon/orchestrator.js"
import { startDaemonServer } from "../lib/daemon/server.js"

const HEARTBEAT_INTERVAL_MS = 10_000
const STALE_AFTER_MS = 30_000

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

  const logFd = openSync(logPath(), "a", 0o600)
  const child = spawn(cfg.cli.binPath, ["daemon", "run"], {
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: process.env,
  })
  child.unref()

  // wait up to 1s for the first heartbeat
  const deadline = Date.now() + 1000
  while (Date.now() < deadline) {
    const hb = readHeartbeat()
    if (hb && Date.now() - hb.lastHeartbeat < STALE_AFTER_MS) {
      console.log(`daemon started (pid ${hb.pid}, socket ${hb.socketPath})`)
      return 0
    }
    await sleep(50)
  }
  console.error("daemon did not start within 1s — check ~/.devdrip/daemon.log")
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
  console.warn("daemon force-killed")
  return 0
}

export async function runStatus(): Promise<string> {
  const hb = readHeartbeat()
  const lines: string[] = []
  if (!hb) {
    lines.push("daemon:    not running")
    return lines.join("\n")
  }
  const age = Date.now() - hb.lastHeartbeat
  if (age > STALE_AFTER_MS) {
    lines.push(`daemon:    stale (last heartbeat ${Math.round(age / 1000)}s ago, pid=${hb.pid})`)
  } else {
    const uptime = Math.round((Date.now() - hb.startedAt) / 1000)
    lines.push(`daemon:    running (pid=${hb.pid}, uptime=${uptime}s, socket=${hb.socketPath})`)
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
  lines.push(`ads shown: ${hb.adsShownThisSession}`)
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

  const orchestrator = createOrchestrator({
    adCache,
    ledger,
    display: { show: showAd },
    log,
    deviceId: cfg.device.id,
  })

  const started: Heartbeat = {
    version: 1,
    pid: process.pid,
    startedAt: Date.now(),
    lastHeartbeat: Date.now(),
    socketPath,
    adsShownThisSession: 0,
  }

  const server = await startDaemonServer({
    socketPath,
    dispatch: (ev) => orchestrator.dispatch(ev),
    onKill: () => {
      void shutdown()
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
    })
  }, HEARTBEAT_INTERVAL_MS)

  let shuttingDown = false
  async function shutdown(): Promise<void> {
    if (shuttingDown) return
    shuttingDown = true
    clearInterval(heartbeatInterval)
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
