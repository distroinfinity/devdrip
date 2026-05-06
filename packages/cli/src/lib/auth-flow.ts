import { spawn } from "node:child_process"
import { createServer, type Server } from "node:http"
import { createServer as createNetServer } from "node:net"
import { platform } from "node:os"

export const CLI_PORT_MIN = 54321
export const CLI_PORT_MAX = 54330

export type CallbackResult = { code: string } | { error: string }

export async function findFreePort(min = CLI_PORT_MIN, max = CLI_PORT_MAX): Promise<number> {
  for (let port = min; port <= max; port += 1) {
    if (await isPortFree(port)) return port
  }
  throw new Error(`ports ${min}-${max} all in use; free one and retry`)
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const probe = createNetServer()
    probe.unref()
    probe.once("error", () => resolve(false))
    probe.once("listening", () => {
      probe.close(() => resolve(true))
    })
    probe.listen(port, "127.0.0.1")
  })
}

const SUCCESS_HTML = `<!doctype html>
<html><head><meta charset="utf-8"><title>distro tv</title>
<style>body{font:16px system-ui;margin:40px;color:#111}h1{font-weight:600}</style>
</head><body>
<h1>you're signed in.</h1>
<p>close this tab and head back to your terminal.</p>
</body></html>`

const ERROR_HTML = (msg: string) => `<!doctype html>
<html><head><meta charset="utf-8"><title>distro tv</title>
<style>body{font:16px system-ui;margin:40px;color:#111}h1{font-weight:600;color:#b00020}</style>
</head><body>
<h1>sign-in failed</h1>
<p>${escapeHtml(msg)}</p>
<p>close this tab and try again in your terminal.</p>
</body></html>`

function escapeHtml(s: string): string {
  return s.replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string
  )
}

export interface CallbackOptions {
  port: number
  timeoutMs?: number
}

/**
 * Starts a one-shot HTTP server on 127.0.0.1:port. Resolves with the first
 * /callback hit (capturing ?code or ?error) and shuts itself down. Rejects on
 * timeout.
 */
export function waitForCallback(opts: CallbackOptions): Promise<CallbackResult> {
  const { port, timeoutMs = 60_000 } = opts
  return new Promise((resolve, reject) => {
    let settled = false
    const server: Server = createServer((req, res) => {
      const url = new URL(req.url ?? "/", `http://127.0.0.1:${port}`)
      if (url.pathname !== "/callback") {
        res.statusCode = 404
        res.end("not found")
        return
      }

      const code = url.searchParams.get("code")
      const error = url.searchParams.get("error")

      if (error) {
        res.setHeader("content-type", "text/html; charset=utf-8")
        res.end(ERROR_HTML(error))
        finish({ error })
        return
      }
      if (code) {
        res.setHeader("content-type", "text/html; charset=utf-8")
        res.end(SUCCESS_HTML)
        finish({ code })
        return
      }

      res.statusCode = 400
      res.end("missing code or error")
      finish({ error: "missing_callback_params" })
    })

    const timer = setTimeout(() => {
      finish(null, new Error("auth timed out — try again"))
    }, timeoutMs)
    timer.unref()

    server.once("error", (err) => finish(null, err))
    server.listen(port, "127.0.0.1")

    function finish(result: CallbackResult | null, err?: Error) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      // small delay lets the HTTP response flush before we close the socket
      setImmediate(() => {
        server.close(() => {
          if (err) reject(err)
          else if (result) resolve(result)
        })
      })
    }
  })
}

export function openBrowser(url: string): void {
  const cmd = browserCommand()
  const child = spawn(cmd.bin, [...cmd.args, url], {
    stdio: "ignore",
    detached: true,
  })
  child.on("error", () => {
    // swallow — caller already printed the URL for the user to open manually
  })
  child.unref()
}

function browserCommand(): { bin: string; args: string[] } {
  switch (platform()) {
    case "darwin":
      return { bin: "open", args: [] }
    case "win32":
      return { bin: "cmd", args: ["/c", "start", '""'] }
    default:
      return { bin: "xdg-open", args: [] }
  }
}
