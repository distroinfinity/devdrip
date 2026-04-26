// Demo-only mock earnings store. Used to drive the Mini App balance counter
// in real time from the CLI's terminal-tv toast events without going through
// the full ad-impression → sync → settle pipeline. Process-local (no Redis,
// no DB) — totals reset on API restart.

const balanceByUser = new Map<string, number>()

export function bumpMockBalance(userId: string, amountUsdc: number): number {
  const next = (balanceByUser.get(userId) ?? 0) + amountUsdc
  balanceByUser.set(userId, next)
  return next
}

export function getMockBalance(userId: string): number {
  return balanceByUser.get(userId) ?? 0
}

export function resetMockBalance(userId: string): void {
  balanceByUser.delete(userId)
}
