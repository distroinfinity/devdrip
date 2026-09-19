// Same-origin fetch wrappers for Mini App API surfaces. All requests target
// /api/miniapp/* (next.config.mjs rewrites to the backend), so the dd_miniapp
// cookie (Path=/miniapp on the backend, which this rewrite preserves) attaches
// automatically.

export interface MiniAppMe {
  id: string
  walletAddress: string | null
  nullifierHash: string | null
  verificationLevel: "device" | "orb" | null
  githubId: number | null
  githubLogin: string | null
  email: string
  avatarUrl: string | null
  signedUpAt: string | null
}

export class MiniAppApiError extends Error {
  constructor(
    public status: number,
    public code: string
  ) {
    super(`${status}: ${code}`)
    this.name = "MiniAppApiError"
  }
}

interface FetchMeOpts {
  cookieHeader?: string
  origin?: string
}

export async function fetchMiniAppMe(opts: FetchMeOpts = {}): Promise<MiniAppMe | null> {
  const url = opts.origin ? `${opts.origin}/api/miniapp/me` : "/api/miniapp/me"
  const headers: Record<string, string> = {}
  if (opts.cookieHeader) headers["cookie"] = opts.cookieHeader
  const r = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    headers,
  })
  if (r.status === 401) return null
  if (!r.ok) {
    const body = await safeJson(r)
    throw new MiniAppApiError(r.status, (body?.error as string) ?? "unknown")
  }
  return (await r.json()) as MiniAppMe
}

async function safeJson(r: Response): Promise<Record<string, unknown> | null> {
  try {
    return (await r.json()) as Record<string, unknown>
  } catch {
    return null
  }
}
