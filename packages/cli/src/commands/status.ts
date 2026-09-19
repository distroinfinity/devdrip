import { Command } from "commander"
import {
  ApiError,
  apiFetch,
  type MeResponse,
  NotAuthenticatedError,
  reportError,
} from "../lib/api-client.js"
import { readConfig } from "../lib/config.js"

export const statusCmd = new Command("status")
  .description("show daemon and session status")
  .action(async () => {
    try {
      const cfg = await readConfig()
      if (!cfg) {
        console.log("auth:     not signed in (run `devdrip auth`)")
        return
      }

      try {
        const me = await apiFetch<MeResponse>("/me")
        const handle = me.githubLogin ?? me.email
        console.log(`auth:     signed in as @${handle}`)
        console.log(`email:    ${me.email}`)
      } catch (err) {
        if (err instanceof NotAuthenticatedError) {
          console.log("auth:     session expired (run `devdrip auth`)")
          return
        }
        if (err instanceof ApiError) {
          const handle = cfg.user.githubLogin || cfg.user.email
          console.log(`auth:     signed in as @${handle} (offline: api ${err.status})`)
          return
        }
        throw err
      }
    } catch (err) {
      reportError(err)
    }
  })
