export const servedKey = (deviceId: string): string => `news:served:${deviceId}`
export const nextPicksKey = (deviceId: string): string => `news:nextpicks:${deviceId}`
// ZSET of ids handed to a device, scored by offered-at ms, marked at selection
// time (not at impression time). each id ages out of the window on its own clock
// (pruned by score on read), so a batch isn't re-offered within ~4h even if
// impressions never sync — the gap that let the same handful repeat.
export const recentlyOfferedKey = (deviceId: string): string => `news:offered:${deviceId}`
export const fetcherLockKey = (sourceId: string): string => `news:fetcher:lock:${sourceId}`
