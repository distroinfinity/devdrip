import { ValidationError } from "../errors/index.js"
import { requireBody } from "./common.js"

export interface GenerateInvitesInput {
  count: number
}

export function validateGenerateInvites(body: unknown): GenerateInvitesInput {
  const b = requireBody(body)
  const count = Number(b["count"])
  if (!Number.isInteger(count) || count < 1 || count > 100) {
    throw new ValidationError("invalid_count")
  }
  return { count }
}
