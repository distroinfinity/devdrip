import {
  CONFIG_VERSION,
  configPath,
  deleteConfig,
  readConfig,
  type DevdripConfig,
} from "./config.js"

// railway-hosted prod api. override with DISTRO_API_URL for local/staging.
// note: api.distro.sh is the eventual public hostname but dns isn't wired yet.
const DEFAULT_BASE_URL = "https://distrotv-api-production.up.railway.app"
const DEFAULT_TIMEOUT_MS = 10_000

// Mirrors the backend `/me` response. Commands that call /me should import this
// instead of redeclaring it.
export interface MeResponse {
  id: string
  githubLogin: string | null
  email: string
  avatarUrl: string | null
  walletAddress?: string | null
  verificationLevel?: "device" | "orb" | null
  signedUpAt?: string | null
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
  constructor(message = "device not registered — run `distro init`") {
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
  const fromEnv = process.env["DISTRO_API_URL"]
  const fromCfg = cfg?.apiUrl
  return (fromEnv ?? fromCfg ?? DEFAULT_BASE_URL).replace(/\/$/, "")
}

// resolve the Authorization header to send for a given config:
// 1. device bearer (device.secret) — M1 primary path for all anon devices
// 2. JWT (auth.accessToken) — M2 magic-link sign-in (not yet live)
// 3. undefined — no auth header (only valid for /devices/register)
function resolveAuthHeader(cfg: DevdripConfig): string | undefined {
  if (cfg.device.secret) return `Bearer device.${cfg.device.secret}`
  if (cfg.auth?.accessToken) return `Bearer ${cfg.auth.accessToken}`
  return undefined
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
 * Unauthenticated request — use for /devices/register, /auth/exchange, etc.
 * Prefers DISTRO_API_URL, then the caller-supplied baseUrl, then the default.
 */
export async function apiFetchPublic<T>(
  path: string,
  init: FetchInit = {},
  baseUrl?: string
): Promise<T> {
  const url = (process.env["DISTRO_API_URL"] ?? baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "")
  return rawFetch<T>(url, path, init)
}

/**
 * Authenticated request backed by ~/.distro/config.json.
 * Sends device bearer (device.secret) when present, JWT otherwise.
 * On JWT 401/token_expired: transparently rotates via /auth/refresh and retries once.
 * On terminal auth failure: config is cleared and NotAuthenticatedError is thrown.
 */
export async function apiFetch<T>(path: string, init: FetchInit = {}): Promise<T> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError()

  const baseUrl = resolveApiUrl(cfg)
  const authHeader = resolveAuthHeader(cfg)

  if (!authHeader) {
    throw new NotAuthenticatedError()
  }

  // device bearer path — no refresh rotation; device secrets are long-lived
  if (cfg.device.secret) {
    return rawFetch<T>(baseUrl, path, init, authHeader)
  }

  // JWT path (M2) — attempt + refresh on expiry
  try {
    return await rawFetch<T>(baseUrl, path, init, authHeader)
  } catch (err) {
    if (!isExpiredAuth(err)) throw err
    const refreshed = await tryRefresh(cfg, baseUrl)
    const refreshedHeader = resolveAuthHeader(refreshed)
    return rawFetch<T>(baseUrl, path, init, refreshedHeader)
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
  // M2: refresh token is no longer stored in config. if we ever add it back,
  // wire it here. for now, on JWT expiry, force re-auth.
  await deleteConfig().catch(() => {})
  throw new NotAuthenticatedError(`session expired — run \`distro init\` (cleared ${configPath()})`)
  void cfg
  void baseUrl
  // unreachable; satisfies TS return type
  return cfg
}

export interface IngestItemResultNewsImpression {
  ok: boolean
  newsId: string
  error?: string
}

export interface IngestNewsImpressionItem {
  newsId: string
  source: string
  deviceId: string
  durationMs: number
  result: string
  openedUrl: boolean
  saved: boolean
}

export interface IngestResponse {
  // post-pivot: only newsImpressions are real. impressions/clicks kept as empty
  // arrays so existing sync.ts applyResults loop doesn't break on index access.
  impressions: { ok: boolean; deliveryToken: string; error?: string }[]
  clicks: { ok: boolean; deliveryToken: string; error?: string }[]
  newsImpressions?: IngestItemResultNewsImpression[]
}

export interface IngestRequest {
  // legacy ad/click fields: CLI sends empty arrays; API accepts + ignores them
  impressions: { deliveryToken: string }[]
  clicks: { deliveryToken: string }[]
  newsImpressions?: IngestNewsImpressionItem[]
}

export async function postIngest(body: IngestRequest): Promise<IngestResponse> {
  return apiFetch<IngestResponse>("/ingest", { method: "POST", body })
}

export interface SaveReadingItemBody {
  newsId: string
  source: string
  headline: string
  url: string
  score: number
}

export async function postReadingSave(body: SaveReadingItemBody): Promise<void> {
  await apiFetch("/me/reading", { method: "POST", body })
}

export async function requestPairingCode(): Promise<{ pairingCode: string; ttlSeconds: number }> {
  return apiFetch<{ pairingCode: string; ttlSeconds: number }>("/devices/pair", {
    method: "POST",
    body: {},
  })
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

// keep CONFIG_VERSION re-export to avoid import churn in callers that imported it from here
export { CONFIG_VERSION }
