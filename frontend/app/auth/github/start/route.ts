import { NextResponse, type NextRequest } from "next/server"
import { setOAuthCsrfCookie } from "@/lib/session"

const API_URL = process.env["API_URL"] ?? "http://localhost:3001"
const API_INTERNAL_SECRET = process.env["API_INTERNAL_SECRET"] ?? ""
const GITHUB_CLIENT_ID = process.env["GITHUB_OAUTH_CLIENT_ID"] ?? ""
const GITHUB_REDIRECT_URI = process.env["GITHUB_OAUTH_REDIRECT_URI"] ?? ""
const GITHUB_SCOPES = "read:user user:email"

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!GITHUB_CLIENT_ID || !GITHUB_REDIRECT_URI) {
    return NextResponse.json({ error: "oauth_not_configured" }, { status: 503 })
  }

  const pair = req.nextUrl.searchParams.get("pair") ?? undefined
  const next = req.nextUrl.searchParams.get("next") ?? undefined

  const resp = await fetch(`${API_URL}/auth/internal/oauth-state-create`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-internal-secret": API_INTERNAL_SECRET,
    },
    body: JSON.stringify({ pair, next }),
  })
  if (!resp.ok) {
    return NextResponse.json({ error: "state_create_failed" }, { status: 502 })
  }
  const { nonce } = (await resp.json()) as { nonce: string }

  await setOAuthCsrfCookie(nonce)

  const authorizeUrl = new URL("https://github.com/login/oauth/authorize")
  authorizeUrl.searchParams.set("client_id", GITHUB_CLIENT_ID)
  authorizeUrl.searchParams.set("redirect_uri", GITHUB_REDIRECT_URI)
  authorizeUrl.searchParams.set("scope", GITHUB_SCOPES)
  authorizeUrl.searchParams.set("state", nonce)

  return NextResponse.redirect(authorizeUrl.toString())
}
