import { NextResponse, type NextRequest } from "next/server"
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./lib/cookies"

// gates /dashboard, /sign-in, /auth/*. landing at `/` is intentionally NOT in
// the matcher — it must render without any auth work.
const PUBLIC_PREFIXES = ["/sign-in", "/auth/callback", "/auth/refresh"]

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl

  const hasAccess = Boolean(req.cookies.get(ACCESS_COOKIE)?.value)
  const hasRefresh = Boolean(req.cookies.get(REFRESH_COOKIE)?.value)

  // /sign-in should not trap signed-in users on it — bounce to /dashboard.
  if (pathname === "/sign-in" && (hasAccess || hasRefresh)) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
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
  // only dashboard-adjacent routes go through the middleware. landing, waitlist
  // api, sitemap, robots, opengraph-image etc. pass straight through.
  matcher: ["/dashboard/:path*", "/sign-in", "/auth/:path*"],
}
