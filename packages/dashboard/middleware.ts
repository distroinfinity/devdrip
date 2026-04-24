import { NextResponse, type NextRequest } from "next/server"
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./lib/cookies"

const PUBLIC_PREFIXES = ["/sign-in", "/auth/callback", "/auth/refresh"]

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  const hasAccess = Boolean(req.cookies.get(ACCESS_COOKIE)?.value)
  const hasRefresh = Boolean(req.cookies.get(REFRESH_COOKIE)?.value)

  if (pathname === "/") {
    const dest = hasAccess || hasRefresh ? "/dashboard" : "/sign-in"
    return NextResponse.redirect(new URL(dest, req.url))
  }

  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"))
  if (isPublic) return NextResponse.next()

  if (hasAccess) return NextResponse.next()

  if (hasRefresh) {
    const url = new URL("/auth/refresh", req.url)
    url.searchParams.set("next", pathname + search)
    return NextResponse.redirect(url)
  }

  return NextResponse.redirect(new URL("/sign-in", req.url))
}

export const config = {
  matcher: [
    // skip static assets, _next internals, /api health probes, favicons, images
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js)).*)",
  ],
}
