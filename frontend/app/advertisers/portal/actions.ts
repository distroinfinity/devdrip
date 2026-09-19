"use server"

import { redirect } from "next/navigation"
import { ApiError, UnauthenticatedError } from "@/lib/api"
import { patchAdStatus, postAd } from "@/lib/advertiser-api"
import type { AdvertiserAd, CreateAdBody } from "@/lib/advertiser-ads"

const SIGN_IN = "/sign-in?next=/advertisers/portal"

export interface AdActionResult {
  ok: boolean
  ad?: AdvertiserAd
  error?: string
}

function fail(err: unknown): AdActionResult {
  if (err instanceof ApiError) {
    // no advertiser routes on this api yet
    if (err.status === 404) return { ok: false, error: "not_available" }
    const body = err.body as { error?: string } | null
    return { ok: false, error: body?.error ?? `api_error_${err.status}` }
  }
  return { ok: false, error: "network_error" }
}

export async function createAd(body: CreateAdBody): Promise<AdActionResult> {
  try {
    return { ok: true, ad: await postAd(body) }
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect(SIGN_IN)
    return fail(err)
  }
}

export async function setAdStatus(
  id: string,
  status: "active" | "paused"
): Promise<AdActionResult> {
  try {
    return { ok: true, ad: await patchAdStatus(id, status) }
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect(SIGN_IN)
    return fail(err)
  }
}
