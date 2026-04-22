export type IdleStartEvent = {
  type: "idle-start"
  tty: string | null
  pid: number
  ts: number
}
export type IdleEndEvent = { type: "idle-end"; ts: number }
export type DismissEvent = { type: "dismiss"; ts: number }
export type KillEvent = { type: "kill"; ts: number }

// Events carried by the hook socket. `kill` is an admin control event handled
// at the server layer, not by the state machine.
export type WireEvent = IdleStartEvent | IdleEndEvent | DismissEvent | KillEvent

function isNumber(x: unknown): x is number {
  return typeof x === "number" && Number.isFinite(x)
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
  if (!isNumber(o["ts"])) return null

  switch (o["type"]) {
    case "idle-start":
      if (!("tty" in o)) return null
      if (o["tty"] !== null && typeof o["tty"] !== "string") return null
      if (!isNumber(o["pid"])) return null
      return { type: "idle-start", tty: o["tty"], pid: o["pid"], ts: o["ts"] }
    case "idle-end":
      return { type: "idle-end", ts: o["ts"] }
    case "dismiss":
      return { type: "dismiss", ts: o["ts"] }
    case "kill":
      return { type: "kill", ts: o["ts"] }
    default:
      return null
  }
}
