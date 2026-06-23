# Incidents

## 2026-06-23 — prod DB offline (Neon free-tier quota exhausted)

**Symptom:** all CLI users saw `offline demo (backend not reachable)`; no news/markets.

**Root cause:** Neon free-tier compute-time quota exhausted (HTTP 402) → `devdrip`
compute suspended (Jun 19) + branch archived (Jun 20) → API DB connections timed out →
`/me/content/next` 500 → CLI demo fallback. Contributing: uncached `/health` `SELECT 1`
pinned the compute active 24/7; no alerting, so the outage was silent for ~4 days.

**Fix:** migrated prod Postgres to Railway Postgres (co-located, private networking),
fresh DB (no data migration). Hardened: railway db target, cached db health probe,
explicit pool options.

**Follow-up (deferred):** alerting on `/health` degraded (external monitor or GH Actions
cron → webhook) so a future DB outage pages instead of going silent.
