const DEFAULT_BASE_URL = "https://devdrip-api-production.up.railway.app"

function readSecret(): string {
  const secret = process.env["DEVDRIP_ADMIN_SECRET"] ?? process.env["ADMIN_SECRET"]
  if (!secret) {
    console.error(
      "admin secret missing — set DEVDRIP_ADMIN_SECRET (or ADMIN_SECRET) in your environment"
    )
    process.exit(1)
  }
  return secret
}

function readBaseUrl(): string {
  return (process.env["DEVDRIP_API_URL"] ?? DEFAULT_BASE_URL).replace(/\/$/, "")
}

type FetchInit = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown
  query?: Record<string, string | number | undefined>
}

export class AdminApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details: Record<string, unknown>
  ) {
    super(`${status}: ${code}`)
    this.name = "AdminApiError"
  }
}

export async function adminFetch<T>(path: string, init: FetchInit = {}): Promise<T> {
  const secret = readSecret()
  const base = readBaseUrl()

  const url = new URL(`${base}${path}`)
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
  }

  const headers: Record<string, string> = {
    "x-admin-secret": secret,
    "content-type": "application/json",
  }

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(10_000),
  })

  const text = await res.text()
  // upstream may return HTML/plain text on proxy errors (502/503 etc). fall back
  // to a synthetic error object so reportError prints a useful message instead
  // of an uncaught SyntaxError from JSON.parse.
  let parsed: Record<string, unknown> = {}
  if (text) {
    try {
      parsed = JSON.parse(text) as Record<string, unknown>
    } catch {
      parsed = {
        error: res.statusText || "non_json_response",
        body: text.slice(0, 500),
      }
    }
  }

  if (!res.ok) {
    const code = typeof parsed["error"] === "string" ? (parsed["error"] as string) : res.statusText
    throw new AdminApiError(res.status, code, parsed)
  }
  return parsed as T
}

export function reportError(err: unknown): never {
  if (err instanceof AdminApiError) {
    console.error(`error: ${err.status} ${err.code}`)
    const extras = { ...err.details }
    delete extras["error"]
    if (Object.keys(extras).length > 0) {
      console.error(JSON.stringify(extras, null, 2))
    }
  } else if (err instanceof Error) {
    console.error(`error: ${err.message}`)
  } else {
    console.error("error: unknown failure")
  }
  process.exit(1)
}
