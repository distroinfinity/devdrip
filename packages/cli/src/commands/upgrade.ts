import { createRequire } from "node:module"
import { Command } from "commander"
import { detectColor, dim, green, yellow } from "../lib/ansi.js"
import { compareSemver, maybeCheck } from "../lib/upgrade-check.js"
import { downloadAndStage, verifyStaged, activate, TARBALL_URL } from "../lib/auto-update.js"

const require = createRequire(import.meta.url)

function currentVersion(): string {
  // path is resolved relative to the bundled entrypoint (dist/index.js), not
  // this source file — tsup inlines all imports. same pattern as src/index.ts.
  const { version = "0.0.0" } = require("../package.json") as { version?: string }
  return version
}

function printStatus(current: string, latest: string, cached: boolean): void {
  const color = detectColor()
  const cacheTag = cached ? dim(" (cached — checked within 7d)", color) : ""
  process.stdout.write(`current: ${current}\n`)
  process.stdout.write(`latest:  ${latest}${cacheTag}\n`)
}

export const upgradeCmd = new Command("upgrade")
  .description("check for updates and apply them if available")
  .option("--force", "bypass the 7-day cache and fetch the latest release now")
  .action(async (opts: { force?: boolean }) => {
    try {
      const current = currentVersion()
      const result = await maybeCheck(current, { force: opts.force ?? false })
      if (!result) {
        // only happens on the passive-check timeout path; direct `upgrade`
        // invocations always fetch until success or throw. belt-and-suspenders.
        console.log(`current: ${current}\nlatest:  unknown (network timeout)`)
        process.exit(0)
      }
      printStatus(current, result.latest, result.cached)
      const color = detectColor()
      const cmp = compareSemver(current, result.latest)
      if (cmp < 0) {
        // outdated — download and apply the update
        process.stdout.write("downloading update…\n")
        try {
          const staged = await downloadAndStage(TARBALL_URL, result.latest)
          if (!(await verifyStaged(staged, result.latest))) {
            console.error("update failed verification — not applied")
            process.exit(1)
          }
          activate(staged, result.latest)
          process.stdout.write(
            `\n${green(`updated to ${result.latest}`, color)} — restart the daemon to run it: distro daemon stop && distro daemon start\n`
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
      process.exit(opts.force ? 1 : 0)
    }
  })
