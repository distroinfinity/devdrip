import { NextResponse, type NextRequest } from "next/server"
import { API_URL } from "@/lib/env"
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from "@/lib/cookies"

interface RefreshResponse {
  token: string
  refresh_token: string
}

// safe paths for `next` — prevents open-redirect via ?next=https://evil
function safeNext(raw: string | null): string {
  if (!raw) return "/dashboard"
  if (!raw.startsWith("/") || raw.startsWith("//")) return "/dashboard"
  return raw
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const next = safeNext(url.searchParams.get("next"))
  const refresh = req.cookies.get(REFRESH_COOKIE)?.value

  if (!refresh) {
    return NextResponse.redirect(new URL("/sign-in?error=session_expired", req.url))
  }

  try {
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
      cache: "no-store",
    })

    if (!res.ok) {
      const response = NextResponse.redirect(new URL("/sign-in?error=session_expired", req.url))
      clearAuthCookies(response)
      return response
    }

    const body = (await res.json()) as RefreshResponse
    if (!body.token || !body.refresh_token) {
      const response = NextResponse.redirect(new URL("/sign-in?error=refresh_invalid", req.url))
      clearAuthCookies(response)
      return response
    }

    const response = NextResponse.redirect(new URL(next, req.url))
    setAuthCookies(response, { access: body.token, refresh: body.refresh_token })
    return response
  } catch {
    const response = NextResponse.redirect(new URL("/sign-in?error=network", req.url))
    clearAuthCookies(response)
    return response
  }
}
