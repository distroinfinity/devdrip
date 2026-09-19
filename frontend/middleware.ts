import { NextResponse, type NextRequest } from "next/server"

const SESSION_COOKIE = "distrotv_session"

export function middleware(req: NextRequest) {
  const isDashboard = req.nextUrl.pathname.startsWith("/dashboard")
  if (!isDashboard) return NextResponse.next()

  const session = req.cookies.get(SESSION_COOKIE)?.value
  if (!session) {
    const url = req.nextUrl.clone()
    url.pathname = "/sign-in"
    url.searchParams.set("next", req.nextUrl.pathname)
    return NextResponse.redirect(url)
  }

  // cookie presence is the gate — server components verify the JWT via getSession()
  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
