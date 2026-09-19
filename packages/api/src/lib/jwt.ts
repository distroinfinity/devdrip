import { SignJWT, jwtVerify, errors as joseErrors } from "jose"
import { randomBytes, createHash } from "node:crypto"

const ALG = "HS256"
const ACCESS_TTL = "1h"
const REFRESH_TTL_DAYS = 30
const ISSUER = "devdrip"
const AUDIENCE = "devdrip"

function encodeSecret(secret: string) {
  return new TextEncoder().encode(secret)
}

export interface JwtPayload {
  sub: string
  github_login: string
}

export async function signAccessToken(payload: JwtPayload, secret: string): Promise<string> {
  return new SignJWT({ github_login: payload.github_login })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .sign(encodeSecret(secret))
}

export async function verifyAccessToken(token: string, secret: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, encodeSecret(secret), {
    algorithms: [ALG],
    issuer: ISSUER,
    audience: AUDIENCE,
  })
  return { sub: payload.sub as string, github_login: payload["github_login"] as string }
}

// dead in M1; M2 wires these into auth_tokens refresh rotation
export function generateRefreshToken(): string {
  return randomBytes(32).toString("hex")
}

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

export function refreshTokenExpiresAt(): Date {
  const d = new Date()
  d.setDate(d.getDate() + REFRESH_TTL_DAYS)
  return d
}

export { joseErrors }
