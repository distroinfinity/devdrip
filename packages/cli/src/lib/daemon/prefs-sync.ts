import type { SyncedPreferences } from "@distrotv/shared"
import { ApiError } from "../api-client.js"
import { readConfig, writeConfig } from "../config.js"
import { getPreferences, putPreferences } from "../preferences-client.js"
import type { SyncLogger } from "./sync.js"

export type PrefsSyncOutcome =
  | "no-config"
  | "no-change"
  | "pulled-from-server"
  | "pushed-to-server"
  | "skipped-network"
  | "failed"

// Compares local + server prefs by `updatedAt` (ISO 8601, lexicographic == chronological).
// Newer wins. Equal = no-op. Returns the outcome so callers can log it.
export async function syncPreferencesOnce(log: SyncLogger): Promise<PrefsSyncOutcome> {
  const cfg = await readConfig()
  if (!cfg) return "no-config"

  let server: SyncedPreferences
  try {
    server = await getPreferences()
  } catch (err) {
    if (err instanceof ApiError || (err instanceof TypeError && /fetch/i.test(err.message))) {
      log.warn("prefs sync: GET failed", { error: (err as Error).message })
      return "skipped-network"
    }
    log.error("prefs sync: GET failed", { error: (err as Error).message })
    return "failed"
  }

  const localUpdatedAt = cfg.preferences.updatedAt
  const serverUpdatedAt = server.updatedAt

  // server is newer → pull
  if (serverUpdatedAt > localUpdatedAt) {
    const next = {
      ...cfg.preferences,
      quietHoursStart: server.quietHoursStart,
      quietHoursEnd: server.quietHoursEnd,
      tzOffsetMinutes: server.tzOffsetMinutes,
      idleSensitivityMs: server.idleSensitivityMs,
      nightMode: server.nightMode,
      channelMode: server.channelMode,
      newsTopics: server.newsTopics ?? [],
      updatedAt: server.updatedAt,
    }
    await writeConfig({ ...cfg, preferences: next })
    log.info("prefs sync: pulled server state", { updatedAt: serverUpdatedAt })
    return "pulled-from-server"
  }

  // local is newer → push
  if (localUpdatedAt > serverUpdatedAt) {
    try {
      const updated = await putPreferences({
        quietHoursStart: cfg.preferences.quietHoursStart,
        quietHoursEnd: cfg.preferences.quietHoursEnd,
        tzOffsetMinutes: cfg.preferences.tzOffsetMinutes,
        idleSensitivityMs: cfg.preferences.idleSensitivityMs,
        nightMode: cfg.preferences.nightMode,
        channelMode: cfg.preferences.channelMode,
      })
      // absorb the server-assigned updatedAt so the next tick is a no-op.
      await writeConfig({
        ...cfg,
        preferences: { ...cfg.preferences, updatedAt: updated.updatedAt },
      })
      log.info("prefs sync: pushed local state", { updatedAt: updated.updatedAt })
      return "pushed-to-server"
    } catch (err) {
      if (err instanceof ApiError || (err instanceof TypeError && /fetch/i.test(err.message))) {
        log.warn("prefs sync: PUT failed", { error: (err as Error).message })
        return "skipped-network"
      }
      log.error("prefs sync: PUT failed", { error: (err as Error).message })
      return "failed"
    }
  }

  return "no-change"
}
