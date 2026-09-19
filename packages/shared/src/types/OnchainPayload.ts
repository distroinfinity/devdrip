import type { SlotLayout } from "./SlotPayload.js"

export interface OnchainAlert {
  type: "range_breach" | "near_breach" | "vol_spike"
  message: string
  firedAt: string
}

export interface OnchainPayload {
  kind: "onchain"
  poolId: string
  poolLabel: string // e.g. "ETH/USDC"
  price: number
  tick: number
  rangeLower: number
  rangeUpper: number
  inRange: boolean
  feeBps: number // current dynamic fee, in bps
  volBps: number // hook ewma volatility, in bps
  feesEarnedUsd: number
  ilPct: number
  layout: SlotLayout
  asOf: string
  positionId?: string
  alert?: OnchainAlert
}
