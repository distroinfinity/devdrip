export type IdleStartEvent = {
  type: "idle-start"
  tty: string | null
}
export type IdleEndEvent = { type: "idle-end" }
export type DismissEvent = { type: "dismiss" }
export type KillEvent = { type: "kill" }
export type ReloadConfigEvent = { type: "reload-config" }
export type SessionStartEvent = { type: "session-start" }

// Events carried by the hook socket. `kill` and `reload-config` are admin
// control events handled at the server layer, not by the state machine.
export type WireEvent =
  | IdleStartEvent
  | IdleEndEvent
  | DismissEvent
  | KillEvent
  | ReloadConfigEvent
  | SessionStartEvent

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
    case "idle-end":
      return { type: "idle-end" }
    case "dismiss":
      return { type: "dismiss" }
    case "kill":
      return { type: "kill" }
    case "reload-config":
      return { type: "reload-config" }
    case "session-start":
      return { type: "session-start" }
    default:
      return null
  }
}
