import {
  accessTokenExpiresAt,
  CONFIG_VERSION,
  configPath,
  deleteConfig,
  readConfig,
  writeConfig,
  type DevdripConfig,
} from "./config.js"

const DEFAULT_BASE_URL = "https://api.devdrip.sh"
const DEFAULT_TIMEOUT_MS = 10_000

// Mirrors the backend `/me` response. Commands that call /me should import this
// instead of redeclaring it.
export interface MeResponse {
  id: string
  githubLogin: string | null
  email: string
  avatarUrl: string | null
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public details: Record<string, unknown>
  ) {
    super(`${status}: ${code}`)
    this.name = "ApiError"
  }
}

export class NotAuthenticatedError extends Error {
  constructor(message = "session expired — run `devdrip auth`") {
    super(message)
    this.name = "NotAuthenticatedError"
  }
}

type FetchInit = Omit<RequestInit, "body" | "headers"> & {
  body?: unknown
  query?: Record<string, string | number | undefined>
  headers?: Record<string, string>
  timeoutMs?: number
}

export function resolveApiUrl(cfg?: DevdripConfig | null): string {
  const fromEnv = process.env["DEVDRIP_API_URL"]
  const fromCfg = cfg?.apiUrl
  return (fromEnv ?? fromCfg ?? DEFAULT_BASE_URL).replace(/\/$/, "")
}

async function rawFetch<T>(
  baseUrl: string,
  path: string,
  init: FetchInit,
  authHeader?: string
): Promise<T> {
  const url = new URL(`${baseUrl}${path}`)
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v !== undefined) url.searchParams.set(k, String(v))
    }
  }

  const headers: Record<string, string> = {
    "content-type": "application/json",
    ...(init.headers ?? {}),
  }
  if (authHeader) headers["authorization"] = authHeader

  const res = await fetch(url, {
    method: init.method ?? "GET",
    headers,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(init.timeoutMs ?? DEFAULT_TIMEOUT_MS),
  })

  const text = await res.text()
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
    throw new ApiError(res.status, code, parsed)
  }
  return parsed as T
}

/**
 * Unauthenticated request — use for /auth/exchange, /auth/refresh, etc.
 * Prefers DEVDRIP_API_URL, then the caller-supplied baseUrl, then the default.
 */
export async function apiFetchPublic<T>(
  path: string,
  init: FetchInit = {},
  baseUrl?: string
): Promise<T> {
  const url = (process.env["DEVDRIP_API_URL"] ?? baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "")
  return rawFetch<T>(url, path, init)
}

/**
 * Authenticated request backed by ~/.devdrip/config.json. On 401 with
 * token_expired, transparently rotates via /auth/refresh and retries once.
 * On terminal auth failure the config is cleared and NotAuthenticatedError is
 * thrown so callers can tell the user to re-auth.
 */
export async function apiFetch<T>(path: string, init: FetchInit = {}): Promise<T> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not signed in — run `devdrip auth`")

  const baseUrl = resolveApiUrl(cfg)

  try {
    return await rawFetch<T>(baseUrl, path, init, `Bearer ${cfg.auth.accessToken}`)
  } catch (err) {
    if (!isExpiredAuth(err)) throw err
    const refreshed = await tryRefresh(cfg, baseUrl)
    return rawFetch<T>(baseUrl, path, init, `Bearer ${refreshed.auth.accessToken}`)
  }
}

function isExpiredAuth(err: unknown): err is ApiError {
  return (
    err instanceof ApiError &&
    err.status === 401 &&
    (err.code === "token_expired" || err.code === "invalid_token")
  )
}

async function tryRefresh(cfg: DevdripConfig, baseUrl: string): Promise<DevdripConfig> {
  try {
    const tokens = await rawFetch<{ token: string; refresh_token: string }>(
      baseUrl,
      "/auth/refresh",
      { method: "POST", body: { refresh_token: cfg.auth.refreshToken } }
    )
    const next: Omit<DevdripConfig, "version"> = {
      apiUrl: cfg.apiUrl,
      auth: {
        accessToken: tokens.token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt: accessTokenExpiresAt(),
      },
      user: cfg.user,
      device: cfg.device,
      cli: cfg.cli,
      preferences: cfg.preferences,
    }
    await writeConfig(next)
    return { ...next, version: CONFIG_VERSION }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      await deleteConfig().catch(() => {})
      throw new NotAuthenticatedError(
        `session expired — run \`devdrip auth\` (cleared ${configPath()})`
      )
    }
    throw err
  }
}

export function reportError(err: unknown): never {
  if (err instanceof NotAuthenticatedError) {
    console.error(err.message)
  } else if (err instanceof ApiError) {
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
