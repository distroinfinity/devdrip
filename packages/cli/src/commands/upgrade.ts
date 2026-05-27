import { createRequire } from "node:module"
import { rmSync } from "node:fs"
import { Command } from "commander"
import { detectColor, dim, green, yellow } from "../lib/ansi.js"
import { compareSemver, checkForUpdate } from "../lib/upgrade-check.js"
import { downloadAndStage, verifyStaged, activate } from "../lib/auto-update.js"
import { readUpdateState, writeUpdateState } from "../lib/install-layout.js"

const require = createRequire(import.meta.url)

function currentVersion(): string {
  // path is resolved relative to the bundled entrypoint (dist/index.js), not
  // this source file — tsup inlines all imports. same pattern as src/index.ts.
  const { version = "0.0.0" } = require("../package.json") as { version?: string }
  return version
}

function printStatus(current: string, latest: string): void {
  process.stdout.write(`current: ${current}\n`)
  process.stdout.write(`latest:  ${latest}\n`)
}

export const upgradeCmd = new Command("upgrade")
  .description("check for updates and apply them if available")
  // --force is still accepted for compatibility; no cache to bypass now —
  // checkForUpdate always goes to the server, so force is a no-op semantically.
  .option("--force", "re-check the server (always the case — no local cache)")
  .action(async (opts: { force?: boolean }) => {
    void opts // force is a no-op; accepted for backward compatibility
    try {
      const current = currentVersion()
      const info = await checkForUpdate(current)
      if (!info) {
        console.log(`current: ${current}\ncouldn't reach update server`)
        process.exit(0)
      }
      printStatus(current, info.latest)
      const color = detectColor()
      const cmp = compareSemver(current, info.latest)
      if (cmp < 0) {
        // outdated — download and apply the update
        process.stdout.write("downloading update…\n")
        try {
          const staged = await downloadAndStage(info.tarballUrl, info.latest)
          if (!(await verifyStaged(staged, info.latest))) {
            rmSync(staged, { recursive: true, force: true })
            console.error("update failed verification — not applied")
            process.exit(1)
          }
          activate(staged, info.latest)
          const st = readUpdateState()
          if (st) writeUpdateState({ ...st, phase: "stable" })
          process.stdout.write(
            `\n${green(`updated to ${info.latest}`, color)} — restart the daemon to run it: distro daemon stop && distro daemon start\n`
          )
        } catch (applyErr) {
          // download/apply failed — fall back to the manual curl hint
          console.error(`auto-update failed: ${(applyErr as Error).message}`)
          process.stdout.write(
            `\n${yellow("→ curl -fsSL https://get.distrotv.xyz/install.sh | sh", color)}\n`
          )
          process.exit(1)
        }
      } else if (cmp === 0) {
        process.stdout.write(`\n${green("you're up to date", color)}\n`)
      } else {
        // local version ahead of the latest release — common during dev builds
        process.stdout.write(
          `\n${dim("(local build ahead of latest release — nothing to do)", color)}\n`
        )
      }
      process.exit(0)
    } catch (err) {
      console.error(`upgrade check failed: ${(err as Error).message}`)
      process.exit(0)
    }
  })
