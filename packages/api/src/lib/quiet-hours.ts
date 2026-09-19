// minutes-since-midnight in user-local time, derived from UTC `now` + tzOffset.
// quietHoursStart/End semantics: start inclusive, end exclusive.
// wrap-midnight (start > end) is supported (e.g. 22:00 → 07:30).
// returns false if either endpoint is null or start === end.
export function isInQuietHours(
  prefs: { quietHoursStart: number | null; quietHoursEnd: number | null; tzOffsetMinutes: number },
  now: Date
): boolean {
  if (prefs.quietHoursStart == null || prefs.quietHoursEnd == null) return false
  const utcMins = now.getUTCHours() * 60 + now.getUTCMinutes()
  const localMins = (((utcMins + prefs.tzOffsetMinutes) % 1440) + 1440) % 1440
  const { quietHoursStart: start, quietHoursEnd: end } = prefs
  if (start === end) return false
  if (start < end) return localMins >= start && localMins < end
  return localMins >= start || localMins < end
}
