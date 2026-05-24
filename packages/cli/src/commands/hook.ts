import { Command } from "commander"
import { daemonSocketPath } from "@distrotv/shared/daemon-socket"
import { sendHookEvent } from "../lib/daemon/hook-client.js"
import { resolveTty } from "../lib/daemon/tty.js"
import { spawnDaemonDetached, tryClaimRespawn } from "../lib/daemon/lifecycle.js"
import { readConfig } from "../lib/config.js"
import type { WireEvent } from "../lib/daemon/protocol.js"

// deliver the event; if the daemon socket is down, revive it so the NEXT hook
// lands. the happy path (daemon alive) does no extra work, so the <200ms slot
// vanish is untouched. always swallows — the hook must exit 0.
async function deliverOrRevive(event: WireEvent, socketPath: string): Promise<void> {
  try {
    const outcome = await sendHookEvent(event, socketPath)
    if (outcome === "unreachable") await maybeRevive()
  } catch {
    /* never escapes */
  }
}

// fire-and-forget daemon revive. debounced (so a crash-looping daemon can't
// spawn-storm) and bails when the cli isn't initialized — we can't OAuth from a
// hook. never awaits daemon readiness; the current event is dropped.
async function maybeRevive(): Promise<void> {
  try {
    if (!tryClaimRespawn()) return
    const cfg = await readConfig()
    const bin = cfg?.cli?.binPath
    if (!cfg?.user?.id || !cfg?.device?.id || !bin) return
    spawnDaemonDetached(bin)
  } catch {
    /* swallow — hook still exits 0 */
  }
}

export async function handlePreTool(socketPath: string = daemonSocketPath()): Promise<void> {
  await deliverOrRevive({ type: "idle-start", tty: resolveTty() }, socketPath)
}

export async function handleStop(socketPath: string = daemonSocketPath()): Promise<void> {
  // S3-14: include tty so the daemon can route idle-end to the right
  // per-tty session when multiple Claude Code windows are open.
  await deliverOrRevive({ type: "idle-end", tty: resolveTty() }, socketPath)
}

export async function handlePromptSubmit(socketPath: string = daemonSocketPath()): Promise<void> {
  await deliverOrRevive({ type: "idle-start", tty: resolveTty() }, socketPath)
}

export async function handleSessionStart(socketPath: string = daemonSocketPath()): Promise<void> {
  await deliverOrRevive({ type: "session-start", tty: resolveTty() }, socketPath)
}

export async function handleSessionEnd(socketPath: string = daemonSocketPath()): Promise<void> {
  await deliverOrRevive({ type: "session-end", tty: resolveTty() }, socketPath)
}

export const hookCmd = new Command("hook")
  .description("internal hook handlers for Claude Code (always exits 0)")
  .addCommand(
    new Command("pre-tool").description("handle PreToolUse hook").action(async () => {
      await handlePreTool()
      process.exit(0)
    })
  )
  .addCommand(
    new Command("stop").description("handle Stop hook").action(async () => {
      await handleStop()
      process.exit(0)
    })
  )
  .addCommand(
    new Command("prompt-submit").description("handle UserPromptSubmit hook").action(async () => {
      await handlePromptSubmit()
      process.exit(0)
    })
  )
  .addCommand(
    new Command("session-start").description("handle SessionStart hook").action(async () => {
      await handleSessionStart()
      process.exit(0)
    })
  )
  .addCommand(
    new Command("session-end").description("handle SessionEnd hook").action(async () => {
      await handleSessionEnd()
      process.exit(0)
    })
  )
