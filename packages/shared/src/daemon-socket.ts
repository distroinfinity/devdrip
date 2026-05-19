import { homedir } from "node:os"
import { join } from "node:path"

// CLI/daemon-only. Kept in a sub-export so the frontend never pulls
// node:os / node:path through the @distrotv/shared barrel.

const SUN_PATH_MAX = 104

// Single source of truth for the daemon socket path. Evaluated lazily on each
// call so tests that override `process.env.HOME` pick up the right home dir.
// Unix domain socket paths have a ~104-byte limit on macOS (sun_path); falls
// back to /tmp/distro-<uid>.sock on the rare long-home-dir case.
export function daemonSocketPath(
  uid: number = typeof process.getuid === "function" ? (process.getuid() as number) : 0
): string {
  const preferred = join(homedir(), ".distro", "daemon.sock")
  if (preferred.length < SUN_PATH_MAX) return preferred
  return `/tmp/distro-${uid}.sock`
}
