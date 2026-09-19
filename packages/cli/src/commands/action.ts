import { Command } from "commander"
import { daemonSocketPath } from "@distrotv/shared/daemon-socket"
import { sendHookEvent } from "../lib/daemon/hook-client.js"
import type { ActionKind } from "../lib/daemon/protocol.js"
import { resolveTty } from "../lib/daemon/tty.js"

async function sendAction(action: ActionKind): Promise<number> {
  try {
    // S3-14: pass the invoking tty so the daemon applies the action to the
    // matching per-tty session instead of whichever happens to be active.
    await sendHookEvent({ type: "action", action, tty: resolveTty() }, daemonSocketPath())
    console.log(`${action} sent`)
    return 0
  } catch (err) {
    console.error(`failed to reach daemon: ${(err as Error).message}`)
    return 1
  }
}

export const discoverCmd = new Command("discover")
  .description("open the current story or link (fallback for [D])")
  .action(async () => {
    process.exit(await sendAction("discover"))
  })

export const skipCmd = new Command("skip")
  .description("advance to the next slot (fallback for [S])")
  .action(async () => {
    process.exit(await sendAction("skip"))
  })

export const killSessionCmd = new Command("kill-session")
  .description("stop feed for the rest of this Claude session (fallback for [K])")
  .action(async () => {
    process.exit(await sendAction("kill-session"))
  })

export const muteCmd = new Command("mute")
  .description("pause feed for 30 minutes (fallback for [M])")
  .action(async () => {
    process.exit(await sendAction("mute"))
  })
