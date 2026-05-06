import { randomBytes } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { Resend, type CreateEmailResponse } from "resend"
import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"
import { hashSecret } from "../lib/secret-hash.js"
import { generateReferralCode } from "../lib/referral.js"
import { getDb } from "../db/index.js"
import { magicLinkTokens } from "../db/schema/magic_link_tokens.js"
import { users } from "../db/schema/users.js"
import { devices } from "../db/schema/devices.js"
import { signAccessToken, SESSION_TTL_SECONDS } from "../lib/jwt.js"
import { magicLinkEmailHtml, magicLinkEmailText } from "../lib/email-templates/magic-link.js"
import { exchangePairingCodeForDeviceId } from "./pairing.service.js"

const TOKEN_TTL_MS = 15 * 60 * 1000

let resendClient: Resend | null = null
function getResend(): Resend {
  if (!resendClient) {
    resendClient = new Resend(env.resendApiKey)
  }
  return resendClient
}

export interface SendMagicLinkInput {
  email: string
  pairingCode?: string
}

const THROTTLE_SECONDS = 60

export async function sendMagicLink(input: SendMagicLinkInput): Promise<void> {
  const email = input.email.trim().toLowerCase()
  if (!isValidEmail(email)) {
    throw new MagicLinkError("invalid_email", 400)
  }

  const db = getDb()

  // per-email throttle: 1 send per 60s for existing users
  const [existingUser] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (existingUser?.magicLinkLastSentAt) {
    const elapsedMs = Date.now() - existingUser.magicLinkLastSentAt.getTime()
    if (elapsedMs < THROTTLE_SECONDS * 1000) {
      throw new MagicLinkError("throttled", 429)
    }
  }

  const rawToken = randomBytes(32).toString("hex")
  const tokenHash = hashSecret(rawToken)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  await db.insert(magicLinkTokens).values({
    email,
    tokenHash,
    pairingCode: input.pairingCode ?? null,
    expiresAt,
  })

  const link = `${env.magicLinkBaseUrl}/auth/magic-link/verify?token=${rawToken}`
  const expiresInMinutes = Math.round(TOKEN_TTL_MS / 60_000)

  // dev-key short-circuit: log the link instead of sending
  if (env.resendApiKey.startsWith("re_dev_") || env.resendApiKey === "re_dev_placeholder") {
    logger.info({ email, link }, "magic-link (dev mode — would have sent email)")
    return
  }

  const SEND_TIMEOUT_MS = 10_000
  let resp: CreateEmailResponse
  try {
    resp = await Promise.race([
      getResend().emails.send({
        from: env.magicLinkFromEmail,
        to: email,
        subject: "Sign in to Distro TV",
        html: magicLinkEmailHtml({ email, link, expiresInMinutes }),
        text: magicLinkEmailText({ email, link, expiresInMinutes }),
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("resend_timeout")), SEND_TIMEOUT_MS)
      ),
    ])
  } catch (err) {
    if (err instanceof Error && err.message === "resend_timeout") {
      logger.error({ email }, "resend send timed out (10s)")
      throw new MagicLinkError("email_send_timeout", 504)
    }
    logger.error({ err, email }, "resend send threw")
    throw new MagicLinkError("email_send_failed", 502)
  }

  if (resp.error) {
    logger.error({ err: resp.error, email }, "resend email send failed")
    throw new MagicLinkError("email_send_failed", 502)
  }

  // stamp last-sent time so the next send is throttled
  if (existingUser) {
    await db
      .update(users)
      .set({ magicLinkLastSentAt: new Date() })
      .where(eq(users.id, existingUser.id))
  }
}

export interface VerifyMagicLinkResult {
  userId: string
  accessToken: string
  email: string
}

export async function verifyMagicLink(rawToken: string): Promise<VerifyMagicLinkResult> {
  const tokenHash = hashSecret(rawToken)
  const db = getDb()

  const [tokenRow] = await db
    .select()
    .from(magicLinkTokens)
    .where(eq(magicLinkTokens.tokenHash, tokenHash))
    .limit(1)

  if (!tokenRow) throw new MagicLinkError("invalid_token", 401)
  if (tokenRow.consumedAt) throw new MagicLinkError("token_already_used", 401)
  if (tokenRow.expiresAt.getTime() < Date.now()) throw new MagicLinkError("token_expired", 401)

  // mark consumed first — prevents double-use even if subsequent steps fail
  await db
    .update(magicLinkTokens)
    .set({ consumedAt: new Date() })
    .where(eq(magicLinkTokens.id, tokenRow.id))

  const email = tokenRow.email
  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1)
  if (!user) {
    const [created] = await db
      .insert(users)
      .values({
        email,
        githubLogin: null,
        signedUpAt: new Date(),
        referralCode: generateReferralCode(),
      })
      .returning()
    if (!created) throw new MagicLinkError("user_create_failed", 500)
    user = created
  }

  // if pairing code present, re-point the paired device to this user
  if (tokenRow.pairingCode) {
    const deviceId = await exchangePairingCodeForDeviceId(tokenRow.pairingCode)
    if (deviceId) {
      const [device] = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1)
      if (device && device.userId !== user.id) {
        const oldUserId = device.userId
        await db.update(devices).set({ userId: user.id }).where(eq(devices.id, deviceId))
        await deleteUserIfNoDevices(oldUserId)
      }
    }
  }

  const accessToken = await signAccessToken(
    { sub: user.id, email },
    env.jwtSecret,
    SESSION_TTL_SECONDS
  )

  return { userId: user.id, accessToken, email }
}

async function deleteUserIfNoDevices(userId: string): Promise<void> {
  const db = getDb()
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(devices)
    .where(eq(devices.userId, userId))
  const count = row?.count ?? 0
  if (count === 0) {
    await db.delete(users).where(eq(users.id, userId))
  }
}

function isValidEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

export class MagicLinkError extends Error {
  constructor(
    public code: string,
    public httpStatus: number,
    message?: string
  ) {
    super(message ?? code)
  }
}
