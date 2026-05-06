import { cookies } from "next/headers"
import { jwtVerify } from "jose"

export const COOKIE_NAME = "distrotv_session"
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

export interface SessionPayload {
  userId: string
  deviceId?: string
  email?: string
  exp: number
}

export async function setSessionCookie(accessToken: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set({
    name: COOKIE_NAME,
    value: accessToken,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  })
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}

export async function getSessionToken(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value ?? null
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = await getSessionToken()
  if (!token) return null
  const secret = new TextEncoder().encode(requireJwtSecret())
  try {
    const { payload } = await jwtVerify(token, secret)
    if (typeof payload.sub !== "string") return null
    return {
      userId: payload.sub,
      deviceId: typeof payload.deviceId === "string" ? payload.deviceId : undefined,
      email: typeof payload.email === "string" ? payload.email : undefined,
      exp: typeof payload.exp === "number" ? payload.exp : 0,
    }
  } catch {
    return null
  }
}

function requireJwtSecret(): string {
  const v = process.env.JWT_SECRET
  if (!v) throw new Error("JWT_SECRET is not configured (frontend)")
  return v
}
