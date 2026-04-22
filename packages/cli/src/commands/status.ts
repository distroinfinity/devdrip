import { Command } from "commander"
import {
  ApiError,
  apiFetch,
  type MeResponse,
  NotAuthenticatedError,
  reportError,
} from "../lib/api-client.js"
import { readConfig } from "../lib/config.js"
import { openLedger } from "../lib/ledger.js"

export const statusCmd = new Command("status")
  .description("show daemon and session status")
  .option("--local", "include local ledger stats (unsynced impression count)")
  .action(async (opts: { local?: boolean }) => {
    try {
      const cfg = await readConfig()

      if (!cfg) {
        console.log("auth:     not signed in (run `devdrip auth`)")
      } else {
        try {
          const me = await apiFetch<MeResponse>("/me")
          const handle = me.githubLogin ?? me.email
          console.log(`auth:     signed in as @${handle}`)
          console.log(`email:    ${me.email}`)
        } catch (err) {
          if (err instanceof NotAuthenticatedError) {
            console.log("auth:     session expired (run `devdrip auth`)")
          } else if (err instanceof ApiError) {
            const handle = cfg.user.githubLogin || cfg.user.email
            console.log(`auth:     signed in as @${handle} (offline: api ${err.status})`)
          } else if (!opts.local) {
            throw err
          } else {
            console.log(`auth:     unknown (${(err as Error).message})`)
          }
        }
      }

      if (opts.local) {
        const ledger = openLedger()
        try {
          console.log(`unsynced: ${ledger.unsyncedCount()}`)
        } finally {
          ledger.close()
        }
      }
    } catch (err) {
      reportError(err)
    }
  })
