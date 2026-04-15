import { SignJWT, jwtVerify } from "jose"
import { randomUUID } from "node:crypto"
import type { AdSurface } from "@devdrip/shared"
import { env } from "../config/env.js"
import { ForbiddenError } from "../errors/index.js"
import { getRedis } from "./redis.js"

const DELIVERY_AUDIENCE = "devdrip:ad-delivery"
const DELIVERY_ISSUER = "devdrip"
const DELIVERY_TTL_SECONDS = 600
const DELIVERY_TOKEN_TTL = "10m"

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
  let payload: Awaited<ReturnType<typeof jwtVerify>>["payload"]

  try {
    const verified = await jwtVerify(token, encodeSecret(env.jwtSecret), {
      algorithms: ["HS256"],
      issuer: DELIVERY_ISSUER,
      audience: DELIVERY_AUDIENCE,
    })
    payload = verified.payload
  } catch {
    throw new ForbiddenError("invalid_or_expired_delivery_token")
  }

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

  if (expectedUserId && userId !== expectedUserId) {
    throw new ForbiddenError("delivery_not_owned")
  }

  const marker = await getRedis().getdel(deliveryKey(jti))
  if (!marker) {
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
