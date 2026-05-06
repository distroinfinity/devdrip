"use server"

import { API_URL } from "@/lib/env"
import { setSessionCookie } from "@/lib/session"

interface ExchangePairResponse {
  userId: string
  deviceId: string
  accessToken: string
}

export async function exchangePairCode(
  pairingCode: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const resp = await fetch(`${API_URL}/auth/exchange-pair`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pairingCode }),
      cache: "no-store",
    })
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({ error: "unknown" }))
      return { ok: false, error: body.error ?? `http_${resp.status}` }
    }
    const body = (await resp.json()) as ExchangePairResponse
    await setSessionCookie(body.accessToken)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network_error" }
  }
}

export async function sendMagicLink(
  email: string,
  pairingCode?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const resp = await fetch(`${API_URL}/auth/magic-link/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...(pairingCode ? { pairingCode } : {}) }),
      cache: "no-store",
    })
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({ error: "unknown" }))
      return { ok: false, error: body.error ?? `http_${resp.status}` }
    }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "network_error" }
  }
}
