// claim/referral/admin/verify/login/auth removed M1; auth re-added M2 (magic-link); admin lives in dashboard from M7
import { realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { Command } from "commander"
import { initCmd } from "./commands/init.js"
import { configCmd } from "./commands/config.js"
import { statusCmd } from "./commands/status.js"
import { daemonCmd } from "./commands/daemon.js"
import { syncCmd } from "./commands/sync.js"
import { demoCmd } from "./commands/demo.js"
import { doctorCmd } from "./commands/doctor.js"
import { uninstallCmd } from "./commands/uninstall.js"
import { upgradeCmd } from "./commands/upgrade.js"
import { hookCmd } from "./commands/hook.js"
import { discoverCmd, killSessionCmd, muteCmd, skipCmd } from "./commands/action.js"
import { preferencesCmd } from "./commands/preferences.js"
import { watchlistCmd } from "./commands/watchlist.js"
import { feedbackCmd } from "./commands/feedback.js"

const require = createRequire(import.meta.url)
const { version = "0.0.0" } = require("../package.json") as {
  version?: string
}

export const program = new Command()
  .name("distro")
  .description("distro tv — your terminal's news + market feed, while the agent works")
  .version(version)
  .exitOverride()

program
  .addCommand(initCmd)
  .addCommand(preferencesCmd)
  .addCommand(configCmd)
  .addCommand(statusCmd)
  .addCommand(daemonCmd)
  .addCommand(syncCmd)
  .addCommand(demoCmd)
  .addCommand(doctorCmd)
  .addCommand(uninstallCmd)
  .addCommand(upgradeCmd)
  .addCommand(hookCmd)
  .addCommand(discoverCmd)
  .addCommand(skipCmd)
  .addCommand(killSessionCmd)
  .addCommand(muteCmd)
  .addCommand(watchlistCmd)
  .addCommand(feedbackCmd)

async function main() {
  await program.parseAsync()
}

const self = realpathSync(fileURLToPath(import.meta.url))
const entry = process.argv[1] ? realpathSync(process.argv[1]) : ""
if (self === entry) {
  main().catch(() => process.exit(0))
}
