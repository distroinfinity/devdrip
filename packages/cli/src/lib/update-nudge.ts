// Holds whether a newer CLI is available, so the status-line panel can nudge
// the user to update. The daemon sets it from the periodic upgrade check
// (`upgrade-check.ts`); `renderSlotLine` reads it and prepends a one-line
// prompt above the slot heading.
let pendingLatest: string | null = null

export function setPendingUpdate(latest: string | null): void {
  pendingLatest = latest
}

export function getPendingUpdate(): string | null {
  return pendingLatest
}
