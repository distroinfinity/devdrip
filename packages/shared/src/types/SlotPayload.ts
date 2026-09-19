import type { NewsPayload } from "./NewsPayload.js"
import type { TickerPayload } from "./TickerPayload.js"
import type { UtilityPayload } from "./UtilityPayload.js"
import type { SponsoredPayload } from "./SponsoredPayload.js"

export type SlotKind = "news" | "ticker" | "utility" | "sponsored" | "portfolio"
export type SlotLayout = "single" | "grid"

// "portfolio" is a reserved future kind with no payload type yet. "utility"
// (CH 03) is generated locally by the daemon — never returned by /me/content/next.
export type SlotPayload = NewsPayload | TickerPayload | UtilityPayload | SponsoredPayload
