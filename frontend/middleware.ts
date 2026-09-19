import { NextResponse, type NextRequest } from "next/server"
import { ACCESS_COOKIE } from "./lib/cookies"

// M2: magic-link sign-in will reintroduce the refresh cookie + rotation loop.
// For M1 (device bearer tokens), access cookie is set manually or not at all.

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const hasAccess = Boolean(req.cookies.get(ACCESS_COOKIE)?.value)

  // bounce already-authed users away from sign-in
  if (pathname === "/sign-in" && hasAccess) {
    return NextResponse.redirect(new URL("/dashboard", req.url))
  }

  // gate /dashboard/* — unauth'd → /sign-in placeholder
  if (!hasAccess) {
    return NextResponse.redirect(new URL("/sign-in", req.url))
  }

  return NextResponse.next()
}

export const config = {
  // only dashboard-adjacent routes go through middleware. landing, waitlist api,
  // sitemap, robots, opengraph-image etc. pass straight through.
  matcher: ["/dashboard/:path*", "/sign-in"],
}
