import type { NewsPayload } from "./NewsPayload.js"
import type { TickerPayload } from "./TickerPayload.js"
import type { OnchainPayload } from "./OnchainPayload.js"

export type SlotKind = "news" | "ticker" | "onchain" | "sponsored" | "portfolio"
export type SlotLayout = "single" | "grid"

// SlotKind includes "sponsored" and "portfolio" as reserved future kinds.
// Their payload types do not exist yet, so a discriminant check on those
// values will narrow SlotPayload to `never`. Add the payload types when
// these kinds become live.
export type SlotPayload = NewsPayload | TickerPayload | OnchainPayload
