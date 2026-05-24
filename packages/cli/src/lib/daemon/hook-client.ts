import { createConnection } from "node:net"
import { daemonSocketPath } from "@distrotv/shared/daemon-socket"
import type { WireEvent } from "./protocol.js"

export const CONNECT_TIMEOUT_MS = 50

/**
 * Fire-and-forget socket writer. Resolves "sent" once the event is written to a
 * live daemon, or "unreachable" if the daemon socket is down (ECONNREFUSED /
 * ENOENT / connect timeout). Never throws, never blocks past CONNECT_TIMEOUT_MS.
 * Callers exit 0 regardless; "unreachable" is the signal to revive the daemon.
 */
export function sendHookEvent(
  event: WireEvent,
  socketPath: string = daemonSocketPath()
): Promise<"sent" | "unreachable"> {
  return new Promise((resolve) => {
    let done = false
    let connected = false
    const finish = (outcome: "sent" | "unreachable"): void => {
      if (done) return
      done = true
      resolve(outcome)
    }

    const socket = createConnection(socketPath)
    socket.setTimeout(CONNECT_TIMEOUT_MS)
    socket.on("connect", () => {
      connected = true
      socket.end(JSON.stringify(event) + "\n")
    })
    socket.on("timeout", () => {
      socket.destroy()
      finish("unreachable")
    })
    socket.on("close", () => finish(connected ? "sent" : "unreachable"))
    socket.on("error", () => finish("unreachable"))
  })
}
