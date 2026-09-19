import { createRequire } from "node:module"
import { Command } from "commander"
import { detectColor, dim, green, yellow } from "../lib/ansi.js"
import { compareSemver, maybeCheck } from "../lib/upgrade-check.js"

const require = createRequire(import.meta.url)

function currentVersion(): string {
  // path is resolved relative to the bundled entrypoint (dist/index.js), not
  // this source file — tsup inlines all imports. same pattern as src/index.ts.
  const { version = "0.0.0" } = require("../package.json") as { version?: string }
  return version
}

function printResult(current: string, latest: string, cached: boolean): void {
  const color = detectColor()
  const cmp = compareSemver(current, latest)
  const cacheTag = cached ? dim(" (cached — checked within 7d)", color) : ""
  process.stdout.write(`current: ${current}\n`)
  process.stdout.write(`latest:  ${latest}${cacheTag}\n`)
  if (cmp < 0) {
    process.stdout.write(`\n${yellow("→ npm install -g @distrotv/cli@latest", color)}\n`)
  } else if (cmp === 0) {
    process.stdout.write(`\n${green("you're up to date", color)}\n`)
  } else {
    // local version ahead of registry — common during dev builds / pre-publish
    process.stdout.write(`\n${dim("(local build ahead of registry — nothing to do)", color)}\n`)
  }
}

export const upgradeCmd = new Command("upgrade")
  .description("check npm registry for updates")
  .option("--force", "bypass the 7-day cache and fetch the registry now")
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
      printResult(current, result.latest, result.cached)
      process.exit(0)
    } catch (err) {
      console.error(`upgrade check failed: ${(err as Error).message}`)
      process.exit(opts.force ? 1 : 0)
    }
  })
