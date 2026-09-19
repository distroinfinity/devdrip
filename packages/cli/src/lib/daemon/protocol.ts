export type IdleStartEvent = {
  type: "idle-start"
  tty: string | null
}
export type IdleEndEvent = { type: "idle-end" }
export type DismissEvent = { type: "dismiss" }
export type KillEvent = { type: "kill" }

// Events carried by the hook socket. `kill` is an admin control event handled
// at the server layer, not by the state machine.
export type WireEvent = IdleStartEvent | IdleEndEvent | DismissEvent | KillEvent

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
    default:
      return null
  }
}
