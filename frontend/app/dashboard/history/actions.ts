"use server"

import { redirect } from "next/navigation"
import {
  getImpression,
  getImpressions,
  type ImpressionDetail,
  type ImpressionListResponse,
  type ListImpressionsFilters,
} from "@/lib/dashboard-api"
import { ApiError, UnauthenticatedError } from "@/lib/api"

// Server Actions run server-side so they can read the dd_access cookie via
// apiFetch. The client component invokes these — the result lands back in the
// client without leaking the bearer token to the browser.

export async function loadMoreImpressions(
  filters: ListImpressionsFilters
): Promise<ImpressionListResponse> {
  try {
    return await getImpressions(filters)
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/auth/refresh?next=/dashboard/history")
    }
    throw err
  }
}

export async function fetchImpressionDetail(id: string): Promise<ImpressionDetail> {
  try {
    return await getImpression(id)
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/auth/refresh?next=/dashboard/history")
    }
    if (err instanceof ApiError && err.status === 404) {
      throw new Error("impression_not_found")
    }
    throw err
  }
}
