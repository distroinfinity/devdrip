import { sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { devices } from "../db/schema/devices.js"

// A device counts as "online" for activity-gated background work (alert
// evaluation) if it phoned home within this window. Returning users self-heal:
// the next content fetch refreshes the heartbeat and they re-enter the set.
export const ONLINE_WINDOW_MINUTES = 15

// Bump device.lastHeartbeat, throttled so the hot content path does at most one
// write per device every couple of minutes. Fire-and-forget; never blocks or
// fails the caller. DB writes are cheap — Redis is the constrained resource.
export async function touchDeviceHeartbeat(deviceId: string): Promise<void> {
  const db = getDb()
  await db
    .update(devices)
    .set({ lastHeartbeat: sql`now()` })
    .where(
      sql`${devices.id} = ${deviceId} AND (${devices.lastHeartbeat} IS NULL OR ${devices.lastHeartbeat} < now() - interval '2 minutes')`
    )
}
