"use server"

import { setPairCookie } from "@/lib/session"

// stash the pair code from the URL into an http-only cookie so the OAuth
// callback can pick it up (the cookie survives the redirect to github.com
// and back, where the query param doesn't).
export async function rememberPairCode(pairingCode: string): Promise<{ ok: true }> {
  await setPairCookie(pairingCode)
  return { ok: true }
}
