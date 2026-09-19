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
//
// Claude Code spawns hooks as detached subprocesses with no controlling tty
// of their own (ps reports `??`). The user's actual interactive terminal is
// inherited several levels up the process tree, so we walk up until we find
// a real tty. The walk caps at 12 ancestors to avoid pathological loops.
function resolvePosix(): string | null {
  let pid = process.pid
  for (let i = 0; i < 12; i++) {
    let out: string
    try {
      out = execSync(`ps -p ${pid} -o tty=,ppid=`, {
        encoding: "utf8",
        timeout: 200,
      })
    } catch {
      return null
    }
    const trimmed = out.trim()
    if (!trimmed) return null
    // ps prints "tty ppid" — split on whitespace.
    const parts = trimmed.split(/\s+/)
    const ttyName = parts[0] ?? ""
    const ppidStr = parts[1] ?? "0"
    if (ttyName && ttyName !== "?" && ttyName !== "??") {
      return ttyName.startsWith("/dev/") ? ttyName : `/dev/${ttyName}`
    }
    const ppid = Number.parseInt(ppidStr, 10)
    if (!Number.isFinite(ppid) || ppid <= 1) return null
    pid = ppid
  }
  return null
}
