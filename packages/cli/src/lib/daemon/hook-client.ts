import { createConnection } from "node:net"
import { daemonSocketPath } from "@distrotv/shared/daemon-socket"
import type { WireEvent } from "./protocol.js"

export const CONNECT_TIMEOUT_MS = 50

/**
 * Fire-and-forget socket writer. Resolves on success, error, or timeout —
 * never throws. Callers exit 0 regardless.
 */
export function sendHookEvent(
  event: WireEvent,
  socketPath: string = daemonSocketPath()
): Promise<void> {
  return new Promise((resolve) => {
    let done = false
    const finish = (): void => {
      if (done) return
      done = true
      resolve()
    }

    const socket = createConnection(socketPath)
    socket.setTimeout(CONNECT_TIMEOUT_MS)
    socket.on("connect", () => {
      socket.end(JSON.stringify(event) + "\n")
    })
    socket.on("timeout", () => {
      socket.destroy()
      finish()
    })
    socket.on("close", finish)
    socket.on("error", finish)
  })
}
