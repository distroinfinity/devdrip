import { NextResponse, type NextRequest } from "next/server"
import { API_URL } from "@/lib/env"
import { ACCESS_COOKIE, clearAuthCookies } from "@/lib/cookies"

async function handle(req: NextRequest) {
  const token = req.cookies.get(ACCESS_COOKIE)?.value

  // fire-and-forget: backend logout revokes the refresh family. if it fails we
  // still want the dashboard session to end, so don't await-fail the response.
  if (token) {
    try {
      await fetch(`${API_URL}/auth/logout`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      })
    } catch {
      // swallow — clear cookies anyway
    }
  }

  const response = NextResponse.redirect(new URL("/sign-in", req.url))
  clearAuthCookies(response)
  return response
}

// allow both GET (for direct links) and POST (preferred — from a form)
export const GET = handle
export const POST = handle
