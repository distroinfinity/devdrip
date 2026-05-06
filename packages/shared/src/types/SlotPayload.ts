import type { NewsPayload } from "./NewsPayload.js"
import type { TickerPayload } from "./TickerPayload.js"

export type SlotKind = "news" | "ticker" | "sponsored" | "portfolio"
export type SlotLayout = "single" | "grid"

export type SlotPayload = NewsPayload | TickerPayload
