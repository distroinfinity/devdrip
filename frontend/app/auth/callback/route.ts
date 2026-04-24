import { NextResponse, type NextRequest } from "next/server"
import { API_URL } from "@/lib/env"
import { setAuthCookies } from "@/lib/cookies"

interface ExchangeResponse {
  token: string
  refresh_token: string
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const error = url.searchParams.get("error")

  if (error) {
    return NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(error)}`, req.url))
  }

  if (!code) {
    return NextResponse.redirect(new URL("/sign-in?error=missing_code", req.url))
  }

  try {
    const res = await fetch(`${API_URL}/auth/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ code }),
      cache: "no-store",
    })

    if (!res.ok) {
      return NextResponse.redirect(new URL("/sign-in?error=exchange_failed", req.url))
    }

    const body = (await res.json()) as ExchangeResponse
    if (!body.token || !body.refresh_token) {
      return NextResponse.redirect(new URL("/sign-in?error=exchange_invalid", req.url))
    }

    const response = NextResponse.redirect(new URL("/dashboard", req.url))
    setAuthCookies(response, { access: body.token, refresh: body.refresh_token })
    return response
  } catch {
    return NextResponse.redirect(new URL("/sign-in?error=network", req.url))
  }
}
