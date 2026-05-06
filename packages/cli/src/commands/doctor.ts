import { homedir } from "node:os"
import { join } from "node:path"
import { Command } from "commander"
import { NotAuthenticatedError, reportError } from "../lib/api-client.js"
import { detectColor, dim, green, red, yellow } from "../lib/ansi.js"
import { readConfig } from "../lib/config.js"
import { runDoctorHealthCheck, type Probe } from "../lib/health.js"

function claudeSettingsPath(): string {
  return join(homedir(), ".claude", "settings.json")
}

interface DoctorPayload {
  ok: boolean
  probes: Probe[]
}

function isWarnProbe(p: Probe): boolean {
  // probeLedgerDisk shoulders the only "ok but warn" case today by prefixing
  // detail with "warn:". keeping the convention stringly-typed avoids adding
  // a new probe status enum for a single caller.
  return p.ok && p.detail.startsWith("warn:")
}

function printHuman(probes: Probe[]): void {
  const color = detectColor()
  for (const p of probes) {
    const warn = isWarnProbe(p)
    const mark = p.ok ? (warn ? yellow("!", color) : green("✓", color)) : red("✗", color)
    const name = warn ? yellow(p.name, color) : p.name
    const detail = p.detail ? ` ${dim(`— ${p.detail}`, color)}` : ""
    process.stdout.write(`${mark}  ${name}${detail}\n`)
    if (!p.ok && p.fix) {
      process.stdout.write(`   ${dim(`→ ${p.fix}`, color)}\n`)
    }
  }
  const failed = probes.filter((p) => !p.ok).length
  const warned = probes.filter(isWarnProbe).length
  process.stdout.write("\n")
  if (failed === 0 && warned === 0) {
    process.stdout.write(`${green("all checks passed", color)}\n`)
  } else if (failed === 0) {
    process.stdout.write(`${yellow(`${warned} warn`, color)} — investigate above\n`)
  } else {
    process.stdout.write(`${red(`${failed} failed`, color)} — see ✗ above\n`)
  }
}

export const doctorCmd = new Command("doctor")
  .description("run health check suite")
  .option("--json", "emit a single JSON object (stable shape for scripting)")
  .action(async (opts: { json?: boolean }) => {
    try {
      const cfg = await readConfig()
      if (!cfg) {
        if (opts.json) {
          const payload: DoctorPayload = {
            ok: false,
            probes: [
              {
                name: "signed in",
                ok: false,
                detail: "not signed in",
                fix: "run `distro auth`",
              },
            ],
          }
          process.stdout.write(`${JSON.stringify(payload)}\n`)
        } else {
          console.log("not signed in — run `distro auth`")
        }
        process.exit(1)
      }
      const probes = await runDoctorHealthCheck(cfg, claudeSettingsPath())
      const ok = probes.every((p) => p.ok)
      if (opts.json) {
        process.stdout.write(`${JSON.stringify({ ok, probes } satisfies DoctorPayload)}\n`)
      } else {
        printHuman(probes)
      }
      process.exit(ok ? 0 : 1)
    } catch (err) {
      if (err instanceof NotAuthenticatedError) {
        reportError(err)
        process.exit(1)
      }
      reportError(err)
      process.exit(1)
    }
  })
