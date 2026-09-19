import { NextResponse, type NextRequest } from "next/server"
import {
  getOAuthCsrfCookie,
  clearOAuthCsrfCookie,
  setSessionCookie,
  getPairCookie,
  clearPairCookie,
} from "@/lib/session"

const API_URL = process.env["API_URL"] ?? "http://localhost:3001"
const API_INTERNAL_SECRET = process.env["API_INTERNAL_SECRET"] ?? ""

export async function GET(req: NextRequest): Promise<NextResponse> {
  const url = req.nextUrl
  const ghCode = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  if (error === "access_denied") {
    return redirectError("oauth_user_denied")
  }
  if (!ghCode || !state) {
    return redirectError("oauth_csrf_failed")
  }

  // double-submit check
  const cookieNonce = await getOAuthCsrfCookie()
  if (!cookieNonce || cookieNonce !== state) {
    return redirectError("oauth_csrf_failed")
  }

  // consume the state from API (single-use)
  const stateResp = await fetch(`${API_URL}/auth/internal/oauth-state-consume`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": API_INTERNAL_SECRET },
    body: JSON.stringify({ nonce: state }),
  })
  if (!stateResp.ok) return redirectError("oauth_state_expired")
  const statePayload = (await stateResp.json()) as { pairCode?: string; next?: string }

  // pair code can also live in cookie (cli-init drop)
  const pairCode = statePayload.pairCode ?? (await getPairCookie()) ?? undefined

  // exchange with API
  const completeResp = await fetch(`${API_URL}/auth/github/complete`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-internal-secret": API_INTERNAL_SECRET },
    body: JSON.stringify({ ghCode, pairCode }),
  })
  if (!completeResp.ok) {
    const body = (await completeResp.json().catch(() => ({}))) as { error?: string }
    return redirectError(body.error ?? "github_unavailable")
  }
  const data = (await completeResp.json()) as {
    sessionJwt: string
    pairBound: boolean
  }

  await setSessionCookie(data.sessionJwt)
  await clearOAuthCsrfCookie()
  if (pairCode) await clearPairCookie()

  // decide where to land
  const safeNext = statePayload.next && statePayload.next.startsWith("/") ? statePayload.next : null
  const target = data.pairBound ? "/setup/channels" : (safeNext ?? "/dashboard")
  return NextResponse.redirect(new URL(target, url.origin))
}

function redirectError(code: string): NextResponse {
  return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(code)}`, baseUrl()))
}

function baseUrl(): string {
  return process.env["WEB_URL"] ?? "http://localhost:3000"
}
