import { ValidationError } from "../errors/index.js"
import { isValidPairCode } from "../lib/crockford.js"

export function parsePairCodeParam(raw: unknown): string {
  if (typeof raw !== "string") throw new ValidationError("invalid_pair_code")
  const upper = raw.toUpperCase()
  if (!isValidPairCode(upper)) throw new ValidationError("invalid_pair_code")
  return upper
}
