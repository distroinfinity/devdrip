// Mini App session JWT — distinct AUDIENCE from the Bearer-token JWT that
// /auth/exchange and the daemon use. Same secret, same algorithm, but the
// audience claim keeps the two surfaces from cross-contaminating: a Mini App
// cookie can never authorize a Bearer call to /me/* and vice versa.

import { SignJWT, jwtVerify, errors as joseErrors } from "jose"

const ALG = "HS256"
const TTL = "30d" // Mini App session lasts 30 days; cookie matches this
const ISSUER = "devdrip"
const MINIAPP_AUDIENCE = "devdrip-miniapp"

function encodeSecret(secret: string) {
  return new TextEncoder().encode(secret)
}

export interface MiniAppJwtPayload {
  sub: string // user_id
  signup: boolean // true once /miniapp/signup/complete has run; false during in-progress signup
}

export async function signMiniAppSession(
  payload: MiniAppJwtPayload,
  secret: string
): Promise<string> {
  return new SignJWT({ signup: payload.signup })
    .setProtectedHeader({ alg: ALG })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(TTL)
    .setIssuer(ISSUER)
    .setAudience(MINIAPP_AUDIENCE)
    .sign(encodeSecret(secret))
}

export async function verifyMiniAppSession(
  token: string,
  secret: string
): Promise<MiniAppJwtPayload> {
  const { payload } = await jwtVerify(token, encodeSecret(secret), {
    algorithms: [ALG],
    issuer: ISSUER,
    audience: MINIAPP_AUDIENCE,
  })
  return { sub: payload.sub as string, signup: payload["signup"] === true }
}

export const MINIAPP_COOKIE_NAME = "dd_miniapp"
export const MINIAPP_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 // 30 days in seconds
export const MINIAPP_COOKIE_PATH = "/m"

export { joseErrors as miniAppJoseErrors }
