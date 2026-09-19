// reuse the existing alert pipeline list key so the daemon's LPOP path delivers onchain alerts too
export { pendingAlertsKey } from "./alert-keys.js"
export const onchainSnapshotKey = (poolId: string): string => `onchain:snap:${poolId}`
