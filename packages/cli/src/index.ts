import { realpathSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { Command } from "commander"
import { initCmd } from "./commands/init.js"
import { authCmd } from "./commands/auth.js"
import { loginCmd } from "./commands/login.js"
import { configCmd } from "./commands/config.js"
import { statusCmd } from "./commands/status.js"
import { daemonCmd } from "./commands/daemon.js"
import { syncCmd } from "./commands/sync.js"
import { claimCmd } from "./commands/claim.js"
import { demoCmd } from "./commands/demo.js"
import { doctorCmd } from "./commands/doctor.js"
import { uninstallCmd } from "./commands/uninstall.js"
import { upgradeCmd } from "./commands/upgrade.js"
import { verifyCmd } from "./commands/verify.js"
import { referralCmd } from "./commands/referral.js"
import { adminCmd } from "./commands/admin.js"
import { hookCmd } from "./commands/hook.js"
import { discoverCmd, killSessionCmd, muteCmd, skipCmd } from "./commands/action.js"
import { preferencesCmd } from "./commands/preferences.js"

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
  .addCommand(loginCmd)
  .addCommand(authCmd)
  .addCommand(configCmd)
  .addCommand(statusCmd)
  .addCommand(daemonCmd)
  .addCommand(syncCmd)
  .addCommand(claimCmd)
  .addCommand(demoCmd)
  .addCommand(doctorCmd)
  .addCommand(uninstallCmd)
  .addCommand(upgradeCmd)
  .addCommand(verifyCmd)
  .addCommand(referralCmd)
  .addCommand(adminCmd)
  .addCommand(hookCmd)
  .addCommand(discoverCmd)
  .addCommand(skipCmd)
  .addCommand(killSessionCmd)
  .addCommand(muteCmd)

async function main() {
  await program.parseAsync()
}

const self = realpathSync(fileURLToPath(import.meta.url))
const entry = process.argv[1] ? realpathSync(process.argv[1]) : ""
if (self === entry) {
  main().catch(() => process.exit(0))
}
