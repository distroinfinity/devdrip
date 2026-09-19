import { apiFetch, ApiError } from "./api"

import type { AdvertiserAd, CreateAdBody } from "./advertiser-ads"

export interface AdsResult {
  ads: AdvertiserAd[]
  // false when the api has no advertiser routes yet or is down — the page shows the empty state
  available: boolean
}

// throws UnauthenticatedError on 401 so the page can send the visitor to sign-in
export async function listAds(): Promise<AdsResult> {
  try {
    const data = await apiFetch<{ ads?: AdvertiserAd[] }>("/advertiser/ads")
    return { ads: Array.isArray(data?.ads) ? data.ads : [], available: true }
  } catch (err) {
    if (err instanceof ApiError) return { ads: [], available: false }
    if (err instanceof TypeError) return { ads: [], available: false }
    throw err
  }
}

export async function postAd(body: CreateAdBody): Promise<AdvertiserAd> {
  const data = await apiFetch<{ ad: AdvertiserAd }>("/advertiser/ads", {
    method: "POST",
    body: JSON.stringify(body),
  })
  return data.ad
}

export async function patchAdStatus(
  id: string,
  status: "active" | "paused"
): Promise<AdvertiserAd> {
  const data = await apiFetch<{ ad: AdvertiserAd }>(`/advertiser/ads/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  })
  return data.ad
}
