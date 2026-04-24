// server-side API base. falls back to NEXT_PUBLIC_API_URL for symmetry in dev.
export const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

// client-visible API base (used by <a href> on the sign-in page, etc.)
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"

// marketing site URL — sign-in page links "new here? join waitlist" to this.
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://devdrip.xyz"

export const IS_PROD = process.env.NODE_ENV === "production"
