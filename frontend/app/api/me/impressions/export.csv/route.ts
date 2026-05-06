import { cookies } from "next/headers"
import { NextResponse, type NextRequest } from "next/server"
import { COOKIE_NAME } from "@/lib/session"
import { API_URL } from "@/lib/env"

// CSV passes through Next so the request stays same-origin and we can attach
// the bearer from the httpOnly session cookie. The browser triggers a
// download via Content-Disposition set by the API; we forward the body
// directly without buffering it.
export async function GET(req: NextRequest): Promise<Response> {
  const jar = await cookies()
  const token = jar.get(COOKIE_NAME)?.value
  if (!token) {
    return NextResponse.redirect(new URL("/sign-in?next=/dashboard/history", req.url))
  }

  const search = req.nextUrl.searchParams.toString()
  const target = `${API_URL}/me/impressions/export.csv${search ? `?${search}` : ""}`

  const upstream = await fetch(target, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/csv",
    },
    cache: "no-store",
  })

  if (upstream.status === 401) {
    return NextResponse.redirect(new URL("/sign-in?next=/dashboard/history", req.url))
  }
  if (!upstream.ok || !upstream.body) {
    return new NextResponse(`upstream ${upstream.status}`, { status: 502 })
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": upstream.headers.get("content-type") ?? "text/csv; charset=utf-8",
      "Content-Disposition":
        upstream.headers.get("content-disposition") ?? `attachment; filename="impressions.csv"`,
    },
  })
}
