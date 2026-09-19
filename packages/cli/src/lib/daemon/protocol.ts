export type IdleStartEvent = {
  type: "idle-start"
  tty: string | null
}
// S3-14: events that target a specific session carry an optional `tty` so the
// daemon can route to the right per-tty session when multiple Claude Code
// windows are active. `tty` is optional on the wire for backward-compat with
// single-terminal clients; the daemon falls back to the single active session
// when omitted.
export type IdleEndEvent = { type: "idle-end"; tty?: string | null }
export type DismissEvent = { type: "dismiss"; tty?: string | null }
export type KillEvent = { type: "kill" }
export type ReloadConfigEvent = { type: "reload-config" }
export type SessionStartEvent = { type: "session-start"; tty?: string | null }

// User-initiated actions dispatched from CLI subcommands (`distro skip`,
// etc.). Separate from the raw-mode key path in `input.ts` so users can
// reliably interact even when their keystrokes lose the tty race with Claude.
export type ActionKind = "discover" | "skip" | "kill-session" | "mute" | "dismiss"
export type ActionEvent = { type: "action"; action: ActionKind; tty?: string | null }

// Events carried by the hook socket. `kill` and `reload-config` are admin
// control events handled at the server layer, not by the state machine.
export type WireEvent =
  | IdleStartEvent
  | IdleEndEvent
  | DismissEvent
  | KillEvent
  | ReloadConfigEvent
  | SessionStartEvent
  | ActionEvent

const VALID_ACTIONS: readonly ActionKind[] = ["discover", "skip", "kill-session", "mute", "dismiss"]

function readOptionalTty(o: Record<string, unknown>): string | null | undefined {
  if (!("tty" in o)) return undefined
  const v = o["tty"]
  if (v === null) return null
  if (typeof v === "string") return v
  return undefined // malformed — treat as absent
}

export function parseWireEvent(line: string): WireEvent | null {
  let v: unknown
  try {
    v = JSON.parse(line)
  } catch {
    return null
  }
  if (typeof v !== "object" || v === null) return null
  const o = v as Record<string, unknown>

  switch (o["type"]) {
    case "idle-start":
      if (!("tty" in o)) return null
      if (o["tty"] !== null && typeof o["tty"] !== "string") return null
      return { type: "idle-start", tty: o["tty"] }
    case "idle-end": {
      const tty = readOptionalTty(o)
      return tty === undefined ? { type: "idle-end" } : { type: "idle-end", tty }
    }
    case "dismiss": {
      const tty = readOptionalTty(o)
      return tty === undefined ? { type: "dismiss" } : { type: "dismiss", tty }
    }
    case "kill":
      return { type: "kill" }
    case "reload-config":
      return { type: "reload-config" }
    case "session-start": {
      const tty = readOptionalTty(o)
      return tty === undefined ? { type: "session-start" } : { type: "session-start", tty }
    }
    case "action": {
      const a = o["action"]
      if (typeof a !== "string") return null
      if (!(VALID_ACTIONS as readonly string[]).includes(a)) return null
      const tty = readOptionalTty(o)
      const base = { type: "action" as const, action: a as ActionKind }
      return tty === undefined ? base : { ...base, tty }
    }
    default:
      return null
  }
}
