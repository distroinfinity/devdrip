import { Command } from "commander"
import { runLogin } from "./login.js"
import { apiFetch, ApiError, NotAuthenticatedError, reportError } from "../lib/api-client.js"
import { configExists, deleteConfig, readConfig } from "../lib/config.js"

// Deprecated — kept as an alias for `devdrip login` for one release. Will be
// removed in the next major version. Existing users running `devdrip auth` see
// the warning + the new flow.
export const authCmd = new Command("auth")
  .description("(deprecated) use `distro login` instead")
  .option("--logout", "sign out and clear the local session")
  .option("-f, --force", "skip the re-auth confirmation prompt")
  .action(async (opts: { logout?: boolean; force?: boolean }) => {
    try {
      if (opts.logout) {
        await runLogout()
        return
      }
      console.error("⚠ `distro auth` is deprecated — use `distro login` instead")
      await runLogin(opts.force === true)
    } catch (err) {
      reportError(err)
    }
  })

async function runLogout(): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) {
    console.log("not signed in")
    return
  }
  try {
    await apiFetch<{ ok: true }>("/auth/logout", { method: "POST" })
  } catch (err) {
    // backend rotation may already be dead — best effort, still clear local config
    if (!(err instanceof NotAuthenticatedError) && !(err instanceof ApiError)) throw err
  }
  await deleteConfig()
  console.log("✓ signed out")
}

// re-export so status and other commands can check config presence without
// importing directly from lib/config in every command
export { configExists }
