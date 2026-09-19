import type { BillingInfo } from "@devdrip/shared"
import { ValidationError } from "../errors/index.js"
import { validateEmail, validateStringField, requireBody } from "./common.js"

const VALID_BILLING_METHODS = ["stripe", "crypto", "invoice"] as const

// ── types ───────────────────────────────────────────────────────────────────

export interface CreateAdvertiserInput {
  name: string
  contactEmail: string
  companyName: string | null
  billingInfo: BillingInfo | null
}

export interface UpdateAdvertiserInput {
  name?: string
  contactEmail?: string
  companyName?: string | null
  billingInfo?: BillingInfo | null
}

// ── billing validation ──────────────────────────────────────────────────────

function validateBillingInfo(val: unknown): BillingInfo {
  if (typeof val !== "object" || val === null || Array.isArray(val)) {
    throw new ValidationError("invalid_billing_info")
  }
  const obj = val as Record<string, unknown>
  const method = obj["method"]
  if (!method || !(VALID_BILLING_METHODS as readonly string[]).includes(method as string)) {
    throw new ValidationError("invalid_billing_method")
  }
  if (method === "stripe" && !obj["stripeCustomerId"]) {
    throw new ValidationError("stripe_customer_id_required")
  }
  if (method === "crypto" && !obj["walletAddress"]) {
    throw new ValidationError("wallet_address_required")
  }
  return val as unknown as BillingInfo
}

// ── create ──────────────────────────────────────────────────────────────────

export function validateCreateAdvertiser(body: unknown): CreateAdvertiserInput {
  const b = requireBody(body)
  const name = validateStringField(b["name"], "name", { required: true, maxLength: 255 })
  const contactEmail = validateEmail(b["contactEmail"], "contact_email")
  const companyName = validateStringField(b["companyName"], "company_name", { maxLength: 255 })
  const billingInfo = b["billingInfo"] !== undefined ? validateBillingInfo(b["billingInfo"]) : null
  return { name, contactEmail, companyName, billingInfo }
}

// ── update ──────────────────────────────────────────────────────────────────

export function validateUpdateAdvertiser(body: unknown): UpdateAdvertiserInput {
  const b = requireBody(body)
  const updates: UpdateAdvertiserInput = {}
  let hasField = false

  if (b["name"] !== undefined) {
    updates.name = validateStringField(b["name"], "name", { required: true, maxLength: 255 })
    hasField = true
  }
  if (b["contactEmail"] !== undefined) {
    updates.contactEmail = validateEmail(b["contactEmail"], "contact_email")
    hasField = true
  }
  if (b["companyName"] !== undefined) {
    updates.companyName =
      b["companyName"] === null
        ? null
        : validateStringField(b["companyName"], "company_name", { maxLength: 255 })
    hasField = true
  }
  if (b["billingInfo"] !== undefined) {
    updates.billingInfo = b["billingInfo"] === null ? null : validateBillingInfo(b["billingInfo"])
    hasField = true
  }

  if (!hasField) throw new ValidationError("no_fields_to_update")
  return updates
}
