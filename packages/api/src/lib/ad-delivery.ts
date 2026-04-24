import { SignJWT, jwtVerify, errors } from "jose"
import { randomUUID } from "node:crypto"
import type { AdSurface } from "@devdrip/shared"
import { env } from "../config/env.js"
import { ForbiddenError } from "../errors/index.js"
import { getRedis } from "./redis.js"

const DELIVERY_AUDIENCE = "devdrip:ad-delivery"
const DELIVERY_ISSUER = "devdrip"
const DELIVERY_TTL_SECONDS = 600
const DELIVERY_TOKEN_TTL = "10m"
const MAX_GRACE_SECONDS = 24 * 60 * 60 // 24h past iat

function encodeSecret(secret: string) {
  return new TextEncoder().encode(secret)
}

function deliveryKey(jti: string): string {
  return `ad:delivery:${jti}`
}

export interface DeliveryClaims {
  userId: string
  deviceId: string
  creativeId: string
  surface: AdSurface
  jti: string
  issuedAt: number
}

export interface IngestVerifyResult {
  claims: DeliveryClaims
  graceAccept: boolean
}

function extractClaims(payload: Awaited<ReturnType<typeof jwtVerify>>["payload"]): DeliveryClaims {
  const userId = payload.sub
  const deviceId = payload["device_id"]
  const creativeId = payload["creative_id"]
  const surface = payload["surface"]
  const jti = payload.jti
  const iat = payload.iat

  if (
    typeof userId !== "string" ||
    typeof deviceId !== "string" ||
    typeof creativeId !== "string" ||
    typeof surface !== "string" ||
    typeof jti !== "string" ||
    typeof iat !== "number"
  ) {
    throw new ForbiddenError("invalid_or_expired_delivery_token")
  }

  return {
    userId,
    deviceId,
    creativeId,
    surface: surface as AdSurface,
    jti,
    issuedAt: iat,
  }
}

async function verifyAllowExpired(token: string): Promise<DeliveryClaims> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(env.jwtSecret), {
      algorithms: ["HS256"],
      issuer: DELIVERY_ISSUER,
      audience: DELIVERY_AUDIENCE,
    })
    return extractClaims(payload)
  } catch (err) {
    if (err instanceof errors.JWTExpired) {
      try {
        const { payload } = await jwtVerify(token, encodeSecret(env.jwtSecret), {
          algorithms: ["HS256"],
          issuer: DELIVERY_ISSUER,
          audience: DELIVERY_AUDIENCE,
          currentDate: new Date(0),
        })
        return extractClaims(payload)
      } catch {
        throw new ForbiddenError("invalid_or_expired_delivery_token")
      }
    }
    throw new ForbiddenError("invalid_or_expired_delivery_token")
  }
}

export async function issueDeliveryToken(
  input: Omit<DeliveryClaims, "jti" | "issuedAt">
): Promise<string> {
  const redis = getRedis()

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const jti = randomUUID()
    const reserve = await redis.set(deliveryKey(jti), "1", { ex: DELIVERY_TTL_SECONDS, nx: true })
    if (reserve !== "OK") continue

    return new SignJWT({
      device_id: input.deviceId,
      creative_id: input.creativeId,
      surface: input.surface,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(input.userId)
      .setIssuedAt()
      .setExpirationTime(DELIVERY_TOKEN_TTL)
      .setIssuer(DELIVERY_ISSUER)
      .setAudience(DELIVERY_AUDIENCE)
      .setJti(jti)
      .sign(encodeSecret(env.jwtSecret))
  }

  throw new Error("unable_to_issue_delivery_token")
}

export async function consumeDeliveryToken(
  token: string,
  expectedUserId?: string
): Promise<DeliveryClaims> {
  const claims = await (async () => {
    try {
      const { payload } = await jwtVerify(token, encodeSecret(env.jwtSecret), {
        algorithms: ["HS256"],
        issuer: DELIVERY_ISSUER,
        audience: DELIVERY_AUDIENCE,
      })
      return extractClaims(payload)
    } catch {
      throw new ForbiddenError("invalid_or_expired_delivery_token")
    }
  })()

  if (expectedUserId && claims.userId !== expectedUserId) {
    throw new ForbiddenError("delivery_not_owned")
  }

  const marker = await getRedis().getdel(deliveryKey(claims.jti))
  if (!marker) {
    throw new ForbiddenError("invalid_or_expired_delivery_token")
  }

  return claims
}

/**
 * Signature + iss + aud verify only. No exp check, no nonce consume.
 * Used for extracting deviceId for the machine rate-limit key.
 */
export async function peekDeliveryToken(token: string): Promise<DeliveryClaims> {
  try {
    const { payload } = await jwtVerify(token, encodeSecret(env.jwtSecret), {
      algorithms: ["HS256"],
      issuer: DELIVERY_ISSUER,
      audience: DELIVERY_AUDIENCE,
      currentDate: new Date(0),
    })
    return extractClaims(payload)
  } catch {
    throw new ForbiddenError("invalid_or_expired_delivery_token")
  }
}

/**
 * Impression ingest: verify signature; accept iat up to 24h old; try to consume
 * the nonce (graceAccept=false if present, true if missing). Anti-replay is
 * enforced at DB layer by the UNIQUE(delivery_jti) constraint — Redis nonce is
 * just the cheap early-reject path.
 */
export async function verifyDeliveryTokenForIngest(
  token: string,
  expectedUserId: string
): Promise<IngestVerifyResult> {
  const claims = await verifyAllowExpired(token)
  if (claims.userId !== expectedUserId) throw new ForbiddenError("delivery_not_owned")

  const nowSec = Math.floor(Date.now() / 1000)
  if (nowSec - claims.issuedAt > MAX_GRACE_SECONDS) {
    throw new ForbiddenError("delivery_token_too_old")
  }

  const marker = await getRedis().getdel(deliveryKey(claims.jti))
  return { claims, graceAccept: marker === null }
}

/**
 * Click ingest: verify signature, allow up to 24h old iat, do NOT touch the
 * nonce. Click anti-replay is `clicks.impression_id UNIQUE` at the DB layer.
 */
export async function verifyDeliveryTokenForClick(
  token: string,
  expectedUserId: string
): Promise<DeliveryClaims> {
  const claims = await verifyAllowExpired(token)
  if (claims.userId !== expectedUserId) throw new ForbiddenError("delivery_not_owned")

  const nowSec = Math.floor(Date.now() / 1000)
  if (nowSec - claims.issuedAt > MAX_GRACE_SECONDS) {
    throw new ForbiddenError("delivery_token_too_old")
  }
  return claims
}
