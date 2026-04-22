import { Command } from "commander"
import { daemonSocketPath } from "@devdrip/shared"
import { sendHookEvent } from "../lib/daemon/hook-client.js"
import { resolveTty } from "../lib/daemon/tty.js"

export async function handlePreTool(socketPath: string = daemonSocketPath()): Promise<void> {
  try {
    await sendHookEvent(
      { type: "idle-start", tty: resolveTty(), pid: process.pid, ts: Date.now() },
      socketPath
    )
  } catch {
    /* never escapes */
  }
}

export async function handleStop(socketPath: string = daemonSocketPath()): Promise<void> {
  try {
    await sendHookEvent({ type: "idle-end", ts: Date.now() }, socketPath)
  } catch {
    /* never escapes */
  }
}

export async function handlePromptSubmit(socketPath: string = daemonSocketPath()): Promise<void> {
  try {
    await sendHookEvent({ type: "dismiss", ts: Date.now() }, socketPath)
  } catch {
    /* never escapes */
  }
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
