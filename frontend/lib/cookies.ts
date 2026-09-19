import type { NextResponse } from "next/server"
import { IS_PROD } from "./env"

export const ACCESS_COOKIE = "dd_access"
export const REFRESH_COOKIE = "dd_refresh"

const ACCESS_MAX_AGE_SECONDS = 60 * 60 * 24 // 24h — backend access tokens
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30d

const baseAttrs = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: IS_PROD,
}

export function setAuthCookies(
  res: NextResponse,
  tokens: { access: string; refresh: string }
): NextResponse {
  res.cookies.set(ACCESS_COOKIE, tokens.access, {
    ...baseAttrs,
    maxAge: ACCESS_MAX_AGE_SECONDS,
  })
  res.cookies.set(REFRESH_COOKIE, tokens.refresh, {
    ...baseAttrs,
    maxAge: REFRESH_MAX_AGE_SECONDS,
  })
  return res
}

export function clearAuthCookies(res: NextResponse): NextResponse {
  res.cookies.set(ACCESS_COOKIE, "", { ...baseAttrs, maxAge: 0 })
  res.cookies.set(REFRESH_COOKIE, "", { ...baseAttrs, maxAge: 0 })
  return res
}
