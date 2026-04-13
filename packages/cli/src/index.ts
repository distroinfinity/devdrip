import { createRequire } from "node:module"
import { Command } from "commander"
import { initCmd } from "./commands/init.js"
import { authCmd } from "./commands/auth.js"
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

const require = createRequire(import.meta.url)
const { version } = require("../package.json") as { version: string }

const program = new Command()
  .name("devdrip")
  .description("earn while your AI agent codes")
  .version(version)

program
  .addCommand(initCmd)
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

program.parse()
