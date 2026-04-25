import type { AdRequest, ServedAdPayload } from "@devdrip/shared"
import { manualAdProvider } from "./ad-selection.service.js"
import { issueDeliveryToken } from "../lib/ad-delivery.js"

export async function fetchServedAds(request: AdRequest): Promise<ServedAdPayload[]> {
  const ads = await manualAdProvider.fetchAds(request)

  return Promise.all(
    ads.map(async (ad) => ({
      ...ad,
      deliveryToken: await issueDeliveryToken({
        userId: request.userId,
        deviceId: request.deviceId,
        creativeId: ad.id,
        surface: request.surface,
      }),
    }))
  )
}
