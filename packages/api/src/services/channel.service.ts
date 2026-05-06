import { eq, and, sql, notInArray } from "drizzle-orm"
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
  // First-time lazy init only — gated by NOT EXISTS so an explicit unsubscribe
  // (e.g. PUT [crypto] dropping tech/finance) is not silently re-undone on the
  // next GET. Single round trip; the WHERE NOT EXISTS makes it atomic and idempotent.
  // Priority ascends with insertion order; tech=0, finance=1.
  await db.execute(sql`
    INSERT INTO channel_subscriptions (user_id, channel_id, priority)
    SELECT
      ${userId}::uuid,
      c.id,
      CASE c.key WHEN 'tech' THEN 0 WHEN 'finance' THEN 1 ELSE 2 END
    FROM channels c
    WHERE c.default_on = true
      AND NOT EXISTS (
        SELECT 1 FROM channel_subscriptions WHERE user_id = ${userId}::uuid
      )
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

// Full-replacement: subscribedKeys IS the new state. Index in the array is the
// priority (0 = top). Caller must pass a non-empty list — the validator guards
// the http path; callers from elsewhere should still expect a thrown error
// rather than a silent zero-sub state.
export async function setSubscriptions(
  userId: string,
  subscribedKeys: ChannelKey[]
): Promise<void> {
  if (subscribedKeys.length === 0) {
    throw new Error("setSubscriptions: subscribedKeys must be non-empty")
  }

  const db = getDb()
  return db.transaction(async (tx) => {
    const allChannels = await tx.select().from(channels)
    const byKey = new Map(allChannels.map((c) => [c.key, c]))

    const subscribedIds: string[] = []
    for (const k of subscribedKeys) {
      const ch = byKey.get(k)
      if (!ch) throw new Error(`unknown channel key: ${k}`)
      subscribedIds.push(ch.id)
    }

    // delete subscriptions no longer in the new set
    await tx
      .delete(channelSubscriptions)
      .where(
        and(
          eq(channelSubscriptions.userId, userId),
          notInArray(channelSubscriptions.channelId, subscribedIds)
        )
      )

    // upsert subscribed with priority = index
    await tx
      .insert(channelSubscriptions)
      .values(subscribedIds.map((channelId, i) => ({ userId, channelId, priority: i })))
      .onConflictDoUpdate({
        target: [channelSubscriptions.userId, channelSubscriptions.channelId],
        set: { priority: sql`EXCLUDED.priority` },
      })
  })
}

export { CHANNEL_KEYS }
