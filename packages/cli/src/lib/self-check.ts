import { openLedger } from "./ledger.js"

// Exercises the riskiest startup work — loading the bundle + the better-sqlite3
// native dep + opening the ledger — so a staged build that can't boot is caught
// BEFORE it becomes `current`. Returns a process exit code.
export async function runSelfCheck(): Promise<number> {
  try {
    const ledger = openLedger()
    ledger.close?.()
    return 0
  } catch (err) {
    process.stderr.write(`self-check failed: ${(err as Error).message}\n`)
    return 1
  }
}
