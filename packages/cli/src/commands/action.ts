import { Command } from "commander"
import { daemonSocketPath } from "@devdrip/shared"
import { sendHookEvent } from "../lib/daemon/hook-client.js"
import type { ActionKind } from "../lib/daemon/protocol.js"

async function sendAction(action: ActionKind): Promise<number> {
  try {
    await sendHookEvent({ type: "action", action }, daemonSocketPath())
    console.log(`${action} sent`)
    return 0
  } catch (err) {
    console.error(`failed to reach daemon: ${(err as Error).message}`)
    return 1
  }
}

export const discoverCmd = new Command("discover")
  .description("open the current ad's URL and advance to the next ad (fallback for [D])")
  .action(async () => {
    process.exit(await sendAction("discover"))
  })

export const skipCmd = new Command("skip")
  .description("advance to the next cached ad (fallback for [S])")
  .action(async () => {
    process.exit(await sendAction("skip"))
  })

export const killSessionCmd = new Command("kill-session")
  .description("stop ads for the rest of this Claude session (fallback for [K])")
  .action(async () => {
    process.exit(await sendAction("kill-session"))
  })

export const muteCmd = new Command("mute")
  .description("pause ads for 30 minutes (fallback for [M])")
  .action(async () => {
    process.exit(await sendAction("mute"))
  })
