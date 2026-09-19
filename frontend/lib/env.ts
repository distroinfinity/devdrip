import { resolveEnv } from "@distrotv/shared"

// server-side resolution: DISTRO_ENV picks the bundle; explicit overrides via
// API_URL / NEXT_PUBLIC_API_URL still win. NEXT_PUBLIC_SITE_URL ditto for webUrl.
const serverBundle = resolveEnv({
  distroEnv: process.env.DISTRO_ENV ?? process.env.NEXT_PUBLIC_DISTRO_ENV,
  apiUrl: process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL,
  webUrl: process.env.NEXT_PUBLIC_SITE_URL,
  nodeEnv: process.env.NODE_ENV,
})

// client-visible resolution: only NEXT_PUBLIC_* vars are available in the browser.
// next inlines them at build time, so this evaluates to a static string per build.
const publicBundle = resolveEnv({
  distroEnv: process.env.NEXT_PUBLIC_DISTRO_ENV,
  apiUrl: process.env.NEXT_PUBLIC_API_URL,
  webUrl: process.env.NEXT_PUBLIC_SITE_URL,
  nodeEnv: process.env.NODE_ENV,
})

export const API_URL = serverBundle.apiUrl
export const PUBLIC_API_URL = publicBundle.apiUrl
export const SITE_URL = publicBundle.webUrl
export const IS_PROD = process.env.NODE_ENV === "production"
