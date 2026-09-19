# Quiet Hours

User-configurable window during which alerts are suppressed. Configured per-user via `preferences.quietHoursStart` (minutes-since-midnight, 0–1439), `preferences.quietHoursEnd` (same), and `preferences.tzOffsetMinutes` (-720..840, the user's local TZ).

## Helper

`isInQuietHours(prefs, now)` lives in `packages/api/src/lib/quiet-hours.ts`. Pure function. Handles same-day windows, wrap-midnight windows (e.g. 22:00 → 07:30), and user-local timezones via `tzOffsetMinutes`. Returns `false` if either endpoint is null or `start === end`.

Unit-tested with 5 cases at `packages/api/src/services/__tests__/quiet-hours.test.ts`:

- Either endpoint null → off
- Same-day window (13:00 → 17:00 UTC)
- Wrap-midnight (22:00 → 07:30 UTC)
- Zero-width (start === end) → off
- TZ offset honored (NYC observer)

## Enforcement points

### Evaluator side (primary)

In `alert-evaluator.service.ts::fireForUser`, before the device fan-out loop:

```typescript
const userPrefs = await loadUserPrefs(c.userId)
if (isInQuietHours(userPrefs, new Date())) {
  return 0 // suppress: no lpush, no alert_events row written
}
```

A failed `lpush` would NOT consume the debounce window (no row written = re-fire is possible). The condition can re-fire on the next 60s tick after the window closes.

### Selection side (defense in depth)

In `ticker-selection.service.ts::nextTickerForDevice`, the LPOP for pending alerts is gated:

```typescript
if (!isInQuietHours(userPrefs, new Date())) {
  const pending = await redis.lpop<PendingAlert>(pendingAlertsKey(args.deviceId))
  if (pending) return await buildTickerPayload(...)
}
// fall through to regular rotation
```

If the queue has a pending alert and the user is in quiet hours, the alert sits in the queue with its 60-min TTL. On the next selection call after the window closes, it gets LPOP'd normally. If the TTL expires while still in quiet hours, the alert is dropped — acceptable because the next evaluator tick re-fires if the breach persists.

## Configuration UIs

- Dashboard: `/dashboard/preferences` → Quiet Hours section. Inputs in HH:MM format.
- CLI: `distro preferences → quiet hours`. Inputs in HH:MM format. Empty start disables.

## Failure modes

| Failure                                        | Behavior                                                                                                            |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| User has no preferences row                    | Fallback `{ quietHoursStart: null, quietHoursEnd: null, tzOffsetMinutes: 0 }` → not in quiet hours → no suppression |
| `tzOffsetMinutes` out of range                 | API validator rejects (-720..840) before write                                                                      |
| Wrap-midnight + user crosses midnight mid-eval | Function correctly identifies in-window state on each call                                                          |
| Both endpoints null                            | Treated as "off" — no suppression                                                                                   |
