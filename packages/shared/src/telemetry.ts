// SDK-agnostic telemetry contract shared by api, cli, and dashboard.
// No posthog import here — each runtime owns its client.

export const TELEMETRY_EVENTS = {
  commandRun: "cli:command_run",
  daemonStateChange: "daemon:state_change",
  syncFail: "sync:fail",
  hookReceived: "hook:received",
} as const

export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[keyof typeof TELEMETRY_EVENTS]

// Release tag: prefer an explicit deploy SHA, else fall back to the passed
// package version, else "unknown". Same value used to group Issues by deploy.
export function resolveRelease(pkgVersion?: string): string {
  return (
    process.env["RAILWAY_GIT_COMMIT_SHA"] ??
    process.env["VERCEL_GIT_COMMIT_SHA"] ??
    process.env["COMMIT_SHA"] ??
    pkgVersion ??
    "unknown"
  )
}

// Hard kill-switch honored by every runtime that reads process env (cli + node).
export function isTelemetryDisabledByEnv(): boolean {
  const v = (process.env["DISTRO_TELEMETRY"] ?? "").trim().toLowerCase()
  return v === "0" || v === "false" || v === "off" || v === "no"
}

// Strip anything path- or token-shaped out of a free-text string before it
// leaves the machine. Default-deny: we only ever send error name/message/stack
// and an explicit property allow-list; this is the second line of defense for
// the message/stack strings themselves.
const ABS_PATH = /(?:\/[\w.\-+@]+){2,}/g // /Users/foo/bar, /home/x/y, /var/...
const WIN_PATH = /[A-Za-z]:\\(?:[\w.\-+@]+\\?)+/g // C:\Users\foo\...
const TOKEN =
  /\b(?:gh[opsu]_[A-Za-z0-9]{16,}|sk-[A-Za-z0-9]{16,}|eyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-.]+)\b/g

export function scrubString(input: string): string {
  return input
    .replace(TOKEN, "[redacted-token]")
    .replace(WIN_PATH, "[path]")
    .replace(ABS_PATH, "[path]")
}

export interface ScrubbedError {
  name: string
  message: string
  stack?: string
}

export function scrubError(err: unknown): ScrubbedError {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: scrubString(err.message),
      stack: err.stack ? scrubString(err.stack) : undefined,
    }
  }
  return { name: "NonError", message: scrubString(String(err)) }
}
