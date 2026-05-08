import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIE = "distrotv_session"

const ADMIN_HOSTS = (process.env["NEXT_PUBLIC_ADMIN_HOSTS"] ?? "")
  .split(",")
  .map((h) => h.trim())
  .filter(Boolean)

export function middleware(req: NextRequest) {
  const host = (req.headers.get("host") ?? "").toLowerCase()
  const isAdmin = ADMIN_HOSTS.some((h) => host === h.toLowerCase())

  // admin subdomain → rewrite to /admin/* internally
  if (isAdmin && !req.nextUrl.pathname.startsWith("/admin")) {
    const url = req.nextUrl.clone()
    url.pathname = req.nextUrl.pathname === "/" ? "/admin" : `/admin${req.nextUrl.pathname}`
    return NextResponse.rewrite(url)
  }

  // user host hitting /admin/* → bounce to admin subdomain
  if (!isAdmin && req.nextUrl.pathname.startsWith("/admin")) {
    const adminHost = ADMIN_HOSTS[0]
    if (adminHost) {
      const url = req.nextUrl.clone()
      url.host = adminHost
      url.pathname = req.nextUrl.pathname.replace(/^\/admin/, "") || "/"
      return NextResponse.redirect(url)
    }
  }

  // dashboard auth gate — cookie presence gates entry; server components verify JWT
  if (req.nextUrl.pathname.startsWith("/dashboard")) {
    const session = req.cookies.get(SESSION_COOKIE)?.value
    if (!session) {
      const url = req.nextUrl.clone()
      url.pathname = "/sign-in"
      url.searchParams.set("next", req.nextUrl.pathname)
      return NextResponse.redirect(url)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next|favicon|robots|sitemap|api).*)"],
}
