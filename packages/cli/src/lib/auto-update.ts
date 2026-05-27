import { spawn } from "node:child_process"
import { join } from "node:path"

// ── shared types ────────────────────────────────────────────────────────────

export interface ExecResult {
  code: number
  stdout: string
}
export type ExecFn = (node: string, args: string[]) => Promise<ExecResult>

const defaultExec: ExecFn = (node, args) =>
  new Promise((resolve) => {
    const child = spawn(node, args, { stdio: ["ignore", "pipe", "ignore"] })
    let out = ""
    child.stdout.on("data", (d: Buffer) => (out += d.toString()))
    child.on("error", () => resolve({ code: 127, stdout: "" }))
    child.on("close", (code) => resolve({ code: code ?? 1, stdout: out }))
  })

export interface AutoUpdateDeps {
  exec?: ExecFn
}

// Gate before activation: the staged build must report the expected version AND
// pass `daemon self-check` (loads native deps + opens ledger). Both must pass.
export async function verifyStaged(
  stagedDir: string,
  expectedVersion: string,
  deps: AutoUpdateDeps = {}
): Promise<boolean> {
  const exec = deps.exec ?? defaultExec
  const entry = join(stagedDir, "dist", "index.js")
  const v = await exec(process.execPath, [entry, "--version"])
  if (v.code !== 0 || v.stdout.trim() !== expectedVersion) return false
  const sc = await exec(process.execPath, [entry, "daemon", "self-check"])
  return sc.code === 0
}
