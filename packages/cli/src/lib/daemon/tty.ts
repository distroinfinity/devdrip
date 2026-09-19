import { execSync } from "node:child_process"
import { closeSync, openSync, readlinkSync } from "node:fs"

let cached: { value: string | null } | null = null

export function resolveTty(): string | null {
  if (cached) return cached.value
  const value = process.platform === "linux" ? resolveLinux() : resolvePosix()
  cached = { value }
  return value
}

// exposed for tests and orchestrator resets (long-running daemon never uses this)
export function resetTtyCache(): void {
  cached = null
}

function resolveLinux(): string | null {
  let fd: number
  try {
    fd = openSync("/dev/tty", "r")
  } catch {
    return null
  }
  try {
    return readlinkSync(`/proc/self/fd/${fd}`)
  } catch {
    return null
  } finally {
    try {
      closeSync(fd)
    } catch {
      /* ignore */
    }
  }
}

// macOS + other POSIX fallback via the process table. `tty(1)` would inspect
// stdin, which Claude Code pipes — ps reads the controlling terminal from
// the kernel's process info and works regardless of stdin/stdout state.
function resolvePosix(): string | null {
  let out: string
  try {
    out = execSync(`ps -p ${process.pid} -o tty=`, {
      encoding: "utf8",
      timeout: 200,
    })
  } catch {
    return null
  }
  const name = out.trim()
  if (!name || name === "?" || name === "??") return null
  return name.startsWith("/dev/") ? name : `/dev/${name}`
}
