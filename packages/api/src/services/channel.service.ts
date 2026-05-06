import { eq, and, sql } from "drizzle-orm"
import type { ChannelDto, ChannelKey } from "@distrotv/shared"
import { getDb } from "../db/index.js"
import { channels } from "../db/schema/channels.js"
import { channelSubscriptions } from "../db/schema/channel_subscriptions.js"

const CHANNEL_KEYS: ChannelKey[] = ["tech", "finance", "crypto", "ai-papers", "design", "gaming"]

export async function listChannels(): Promise<ChannelDto[]> {
  const db = getDb()
  const rows = await db.select().from(channels).orderBy(channels.key)
  return rows.map((r) => ({
    id: r.id,
    key: r.key as ChannelKey,
    label: r.label,
    defaultOn: r.defaultOn,
  }))
}

export async function ensureDefaultSubscriptions(userId: string): Promise<void> {
  const db = getDb()
  // INSERT ... SELECT ... ON CONFLICT DO NOTHING — idempotent + single round trip.
  // Priority ascends with insertion order; tech=0, finance=1.
  await db.execute(sql`
    INSERT INTO channel_subscriptions (user_id, channel_id, priority)
    SELECT
      ${userId}::uuid,
      c.id,
      CASE c.key WHEN 'tech' THEN 0 WHEN 'finance' THEN 1 ELSE 2 END
    FROM channels c
    WHERE c.default_on = true
    ON CONFLICT (user_id, channel_id) DO NOTHING
  `)
}

export async function getSubscriptionsForUser(userId: string): Promise<ChannelDto[]> {
  const db = getDb()
  await ensureDefaultSubscriptions(userId)
  const rows = await db
    .select({
      id: channels.id,
      key: channels.key,
      label: channels.label,
      defaultOn: channels.defaultOn,
      priority: channelSubscriptions.priority,
    })
    .from(channels)
    .leftJoin(
      channelSubscriptions,
      and(eq(channelSubscriptions.channelId, channels.id), eq(channelSubscriptions.userId, userId))
    )
    .orderBy(channels.key)

  return rows.map((r) => ({
    id: r.id,
    key: r.key as ChannelKey,
    label: r.label,
    defaultOn: r.defaultOn,
    subscribed: r.priority !== null,
    priority: r.priority ?? 0,
  }))
}

export interface ChannelSubscriptionUpdate {
  key: ChannelKey
  subscribed: boolean
  priority: number
}

export async function setSubscriptions(
  userId: string,
  updates: ChannelSubscriptionUpdate[]
): Promise<void> {
  const db = getDb()
  const allChannels = await db.select().from(channels)
  const byKey = new Map(allChannels.map((c) => [c.key, c]))

  for (const u of updates) {
    const ch = byKey.get(u.key)
    if (!ch) throw new Error(`unknown channel key: ${u.key}`)
    if (u.subscribed) {
      await db
        .insert(channelSubscriptions)
        .values({ userId, channelId: ch.id, priority: u.priority })
        .onConflictDoUpdate({
          target: [channelSubscriptions.userId, channelSubscriptions.channelId],
          set: { priority: u.priority },
        })
    } else {
      await db
        .delete(channelSubscriptions)
        .where(
          and(eq(channelSubscriptions.userId, userId), eq(channelSubscriptions.channelId, ch.id))
        )
    }
  }
}

export { CHANNEL_KEYS }
