export const servedKey = (deviceId: string): string => `news:served:${deviceId}`
export const nextPicksKey = (deviceId: string): string => `news:nextpicks:${deviceId}`
export const fetcherLockKey = (sourceId: string): string => `news:fetcher:lock:${sourceId}`
