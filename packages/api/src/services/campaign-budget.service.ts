import { getDailySpend, getHourlySpend } from "../lib/budget.js"

export { getDailySpend, getHourlySpend }

// budget service wraps lib/budget.ts for campaign-level operations
// the core pacing algorithms (recordSpend, hourlyCapForStrategy, nextCreativeIndex)
// remain in lib/budget.ts and will be called directly by the impression pipeline
