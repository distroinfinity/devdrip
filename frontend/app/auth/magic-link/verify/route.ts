import { NextResponse, type NextRequest } from "next/server"
import { API_URL } from "@/lib/env"
import { COOKIE_NAME } from "@/lib/session"

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const token = url.searchParams.get("token")

  if (!token) {
    return NextResponse.redirect(new URL("/sign-in?error=missing_token", req.url))
  }

  try {
    const resp = await fetch(`${API_URL}/auth/magic-link/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store",
    })

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({ error: "unknown" }))
      return NextResponse.redirect(
        new URL(`/sign-in?error=${encodeURIComponent(body.error ?? "verify_failed")}`, req.url)
      )
    }

    const body = (await resp.json()) as { userId: string; accessToken: string; email: string }

    const response = NextResponse.redirect(new URL("/setup", req.url))
    response.cookies.set({
      name: COOKIE_NAME,
      value: body.accessToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60,
    })
    return response
  } catch {
    return NextResponse.redirect(
      new URL(`/sign-in?error=${encodeURIComponent("network")}`, req.url)
    )
  }
}
