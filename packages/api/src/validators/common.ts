import { ValidationError } from "../errors/index.js"

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateUUID(val: unknown, field = "id"): string {
  if (typeof val !== "string" || !UUID_RE.test(val)) {
    throw new ValidationError(`invalid_${field}`)
  }
  return val
}

export function validateEmail(val: unknown, field = "email"): string {
  if (typeof val !== "string" || !EMAIL_RE.test(val) || val.length > 255) {
    throw new ValidationError(`invalid_${field}`)
  }
  return val
}

export function validateUrl(val: unknown, field = "url"): string {
  if (typeof val !== "string" || val.length > 2048) {
    throw new ValidationError(`invalid_${field}`)
  }
  try {
    const parsed = new URL(val)
    if (parsed.protocol !== "https:") throw new Error()
  } catch {
    throw new ValidationError(`invalid_${field}`)
  }
  return val
}

export function validateOptionalUrl(val: unknown, field = "url"): string | null {
  if (val === undefined || val === null) return null
  return validateUrl(val, field)
}

export function validateStringField(
  val: unknown,
  field: string,
  opts: { required: true; maxLength: number }
): string
export function validateStringField(
  val: unknown,
  field: string,
  opts: { required?: false; maxLength: number }
): string | null
export function validateStringField(
  val: unknown,
  field: string,
  opts: { required?: boolean; maxLength: number }
): string | null {
  if (val === undefined || val === null) {
    if (opts.required) throw new ValidationError(`invalid_${field}`)
    return null
  }
  if (
    typeof val !== "string" ||
    (opts.required && val.length === 0) ||
    val.length > opts.maxLength
  ) {
    throw new ValidationError(`invalid_${field}`)
  }
  return val
}

export function validatePositiveNumber(val: unknown, field: string): number {
  if (typeof val !== "number" || val <= 0 || !isFinite(val)) {
    throw new ValidationError(`invalid_${field}`)
  }
  return val
}

export function validateOptionalPositiveNumber(val: unknown, field: string): number | undefined {
  if (val === undefined) return undefined
  return validatePositiveNumber(val, field)
}

export function validateEnumArray(val: unknown, validValues: string[], field: string): string[] {
  if (val === undefined) return []
  if (!Array.isArray(val)) throw new ValidationError(`invalid_${field}`)
  for (const item of val) {
    if (typeof item !== "string" || !validValues.includes(item)) {
      throw new ValidationError(`invalid_${field}`)
    }
  }
  return val as string[]
}

export function validateEnumValue(
  val: unknown,
  validValues: readonly string[],
  field: string
): string {
  if (typeof val !== "string" || !validValues.includes(val)) {
    throw new ValidationError(`invalid_${field}`)
  }
  return val
}

export function validateOptionalEnumValue(
  val: unknown,
  validValues: readonly string[],
  field: string,
  defaultVal: string
): string {
  if (val === undefined) return defaultVal
  return validateEnumValue(val, validValues, field)
}

export function validateDate(val: unknown, field: string): Date | null {
  if (val === undefined || val === null) return null
  if (typeof val !== "string") throw new ValidationError(`invalid_${field}`)
  const d = new Date(val)
  if (isNaN(d.getTime())) throw new ValidationError(`invalid_${field}`)
  return d
}

export function validatePagination(query: Record<string, unknown>): {
  limit: number
  offset: number
} {
  const rawLimit = Number(query["limit"] ?? 20)
  const rawOffset = Number(query["offset"] ?? 0)
  const limit = Math.min(Math.max(isNaN(rawLimit) ? 20 : rawLimit, 1), 100)
  const offset = Math.max(isNaN(rawOffset) ? 0 : rawOffset, 0)
  return { limit, offset }
}

export function requireBody(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new ValidationError("invalid_body")
  }
  return body as Record<string, unknown>
}
