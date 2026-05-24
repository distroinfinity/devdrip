export const servedKey = (deviceId: string): string => `news:served:${deviceId}`
export const nextPicksKey = (deviceId: string): string => `news:nextpicks:${deviceId}`
// short-lived set of ids handed to a device, marked at selection time (not at
// impression time). guarantees a batch isn't re-offered within the TTL even if
// impressions never sync — the gap that let the same handful repeat.
export const recentlyOfferedKey = (deviceId: string): string => `news:offered:${deviceId}`
export const fetcherLockKey = (sourceId: string): string => `news:fetcher:lock:${sourceId}`
