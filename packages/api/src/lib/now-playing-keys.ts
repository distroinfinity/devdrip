export const nowPlayingKey = (deviceId: string): string => `device:nowplaying:${deviceId}`
export const NOW_PLAYING_TTL_SEC = 20 // slot duration (~15s) + 5s safety buffer
