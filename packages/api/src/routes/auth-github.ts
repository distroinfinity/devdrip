import { Router } from "express"
import { z } from "zod"
import { eq } from "drizzle-orm"
import { env } from "../config/env.js"
import { getDb } from "../db/index.js"
import { users } from "../db/schema/users.js"
import { devices } from "../db/schema/devices.js"
import { exchangeCodeForProfile, GitHubOAuthError } from "../services/github-oauth.service.js"
import { markPairReady, peekPair } from "../services/pairing.service.js"
import { generateDeviceSecret, hashSecret } from "../lib/secret-hash.js"
import { signAccessToken, SESSION_TTL_SECONDS } from "../lib/jwt.js"
import { logger } from "../lib/logger.js"
import { generateReferralCode } from "../lib/referral.js"

export const authGithubCompleteRouter: ReturnType<typeof Router> = Router()

const bodySchema = z.object({
  ghCode: z.string().min(1),
  pairCode: z.string().min(8).max(64).optional(),
})

authGithubCompleteRouter.post("/", async (req, res) => {
  // s2s shared-secret gate
  const provided = req.header("x-internal-secret")
  if (!provided || provided !== env.apiInternalSecret) {
    await res.status(403).json({ error: "forbidden" })
    return
  }

  const parse = bodySchema.safeParse(req.body)
  if (!parse.success) {
    await res.status(400).json({ error: "invalid_body" })
    return
  }
  const { ghCode, pairCode } = parse.data

  // 1) exchange + fetch profile
  let profile
  try {
    profile = await exchangeCodeForProfile(ghCode)
  } catch (err) {
    if (err instanceof GitHubOAuthError) {
      await res.status(err.httpStatus).json({ error: err.code })
      return
    }
    logger.error({ err }, "github exchange unexpected error")
    await res.status(502).json({ error: "github_unavailable" })
    return
  }

  // 2) upsert user by github_id
  const db = getDb()
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.githubId, profile.githubId))
    .limit(1)

  let userId: string
  const existingUser = existing[0]
  if (existingUser) {
    await db
      .update(users)
      .set({
        githubLogin: profile.login,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        updatedAt: new Date(),
      })
      .where(eq(users.id, existingUser.id))
    userId = existingUser.id
  } else {
    // referralCode is still NOT NULL until phase 5 migration drops the column —
    // populate it for now so the insert doesn't violate the constraint.
    const [created] = await db
      .insert(users)
      .values({
        githubId: profile.githubId,
        githubLogin: profile.login,
        email: profile.email,
        avatarUrl: profile.avatarUrl,
        signedUpAt: new Date(),
        referralCode: generateReferralCode(),
      })
      .returning()
    if (!created) {
      await res.status(500).json({ error: "user_create_failed" })
      return
    }
    userId = created.id
  }

  // 3) if pairCode present, create a device and mark pair ready
  let pairBound = false
  if (pairCode) {
    const current = await peekPair(pairCode)
    if (!current) {
      logger.info({ pairCode }, "pair expired before oauth complete")
    } else {
      const deviceSecret = generateDeviceSecret()
      const deviceSecretHash = hashSecret(deviceSecret)
      const [device] = await db
        .insert(devices)
        .values({
          userId,
          machineIdHash: deviceSecretHash.slice(0, 64),
          deviceName: null,
          os: "unknown",
          ideType: "terminal",
          deviceSecretHash,
          lastHeartbeat: new Date(),
        })
        .returning()
      if (!device) {
        await res.status(500).json({ error: "device_create_failed" })
        return
      }
      const deviceToken = `device.${deviceSecret}`
      await markPairReady({
        code: pairCode,
        deviceId: device.id,
        userId,
        deviceToken,
      })
      pairBound = true
    }
  }

  // 4) mint session JWT for the dashboard
  const sessionJwt = await signAccessToken(
    { sub: userId, email: profile.email, github_login: profile.login },
    env.jwtSecret,
    SESSION_TTL_SECONDS
  )

  await res.status(200).json({
    sessionJwt,
    user: {
      id: userId,
      githubLogin: profile.login,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
    },
    pairBound,
  })
})
