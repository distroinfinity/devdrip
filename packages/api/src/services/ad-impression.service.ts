import { and, eq, sql } from "drizzle-orm"
import { MIN_COMPLETED_DURATION_MS, REVENUE_SHARE_DEVELOPER } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { adImpressions } from "../db/schema/ad_impressions.js"
import { fireBeacon } from "../lib/beacon.js"

const RESULTS = new Set(["completed", "skipped", "expired", "interrupted"])
const MAX_DURATION_MS = 60_000
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface AdImpressionInput {
  deliveryToken: string
  durationMs: number
  result: string
}

export function isDeliveryId(v: string): boolean {
  return UUID_RE.test(v)
}

export function parseAdImpression(raw: unknown): AdImpressionInput | null {
  if (!raw || typeof raw !== "object") return null
  const r = raw as Record<string, unknown>
  const token = r["deliveryToken"]
  const duration = r["durationMs"]
  const result = r["result"]
  if (
    typeof token !== "string" ||
    !isDeliveryId(token) ||
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration < 0 ||
    typeof result !== "string" ||
    !RESULTS.has(result)
  ) {
    return null
  }
  return {
    deliveryToken: token,
    durationMs: Math.min(Math.round(duration), MAX_DURATION_MS),
    result,
  }
}

// estimated developer share for one impression. viewable = on screen >= 1s and not skipped.
export function computeEarned(durationMs: number, result: string, cpmRate: number): number {
  if (!Number.isFinite(durationMs) || !Number.isFinite(cpmRate) || cpmRate <= 0) return 0
  if (result === "skipped" || durationMs < MIN_COMPLETED_DURATION_MS) return 0
  return (cpmRate / 1000) * REVENUE_SHARE_DEVELOPER
}

export type AdIngestOutcome = "ok" | "invalid_or_expired_delivery_token" | "delivery_not_owned"

// fills in the "pending" delivery row. a row that is already filled is left
// alone, so a retried batch is ok and never pays twice.
export async function recordAdImpression(args: {
  userId: string
  input: AdImpressionInput
}): Promise<AdIngestOutcome> {
  const db = getDb()
  const [row] = await db
    .select({
      userId: adImpressions.userId,
      result: adImpressions.result,
      cpmRate: adImpressions.cpmRate,
      viewBeaconUrl: adImpressions.viewBeaconUrl,
    })
    .from(adImpressions)
    .where(eq(adImpressions.deliveryId, args.input.deliveryToken))
    .limit(1)
  if (!row) return "invalid_or_expired_delivery_token"
  if (row.userId !== args.userId) return "delivery_not_owned"
  if (row.result !== "pending") return "ok"

  const earned = computeEarned(args.input.durationMs, args.input.result, Number(row.cpmRate))
  const updated = await db
    .update(adImpressions)
    .set({
      durationMs: args.input.durationMs,
      result: args.input.result,
      earnedAmount: earned.toFixed(6),
    })
    .where(
      and(
        eq(adImpressions.deliveryId, args.input.deliveryToken),
        eq(adImpressions.result, "pending")
      )
    )
    .returning({ id: adImpressions.id })

  // only the request that actually flipped the row fires the network's view beacon
  if (updated.length > 0 && earned > 0 && row.viewBeaconUrl) void fireBeacon(row.viewBeaconUrl)
  return "ok"
}

// marks the delivery clicked and returns the advertiser url, or null when unknown.
export async function recordAdClick(deliveryId: string): Promise<string | null> {
  if (!isDeliveryId(deliveryId)) return null
  const [before] = await getDb()
    .select({ clicked: adImpressions.clicked })
    .from(adImpressions)
    .where(eq(adImpressions.deliveryId, deliveryId))
    .limit(1)
  if (!before) return null
  const [row] = await getDb()
    .update(adImpressions)
    .set({ clicked: true, clickedAt: sql`coalesce(${adImpressions.clickedAt}, now())` })
    .where(eq(adImpressions.deliveryId, deliveryId))
    .returning({
      targetUrl: adImpressions.targetUrl,
      clickBeaconUrl: adImpressions.clickBeaconUrl,
    })
  if (!row) return null
  if (!before.clicked && row.clickBeaconUrl) void fireBeacon(row.clickBeaconUrl)
  return row.targetUrl
}
