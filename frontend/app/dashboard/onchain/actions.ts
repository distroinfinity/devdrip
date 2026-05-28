"use server"

import { redirect } from "next/navigation"
import {
  createOnchainPosition,
  deleteOnchainPosition as apiDeleteOnchainPosition,
  getPoolSnapshot,
  type CreateOnchainPositionBody,
  type OnchainPosition,
  type PoolSnapshot,
} from "@/lib/dashboard-api"
import { ApiError, UnauthenticatedError } from "@/lib/api"

export interface CreatePositionResult {
  ok: boolean
  position?: OnchainPosition
  error?: string
}

// register form submit calls this, then the client appends the returned row
export async function registerPosition(
  body: CreateOnchainPositionBody
): Promise<CreatePositionResult> {
  try {
    const position = await createOnchainPosition(body)
    return { ok: true, position }
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/auth/refresh?next=/dashboard/onchain")
    }
    if (err instanceof ApiError) {
      const b = err.body as { error?: string } | null
      return { ok: false, error: b?.error ?? `api_error_${err.status}` }
    }
    return { ok: false, error: "network_error" }
  }
}

export interface DeletePositionResult {
  ok: boolean
  error?: string
}

// row stop-watching button calls this after optimistic remove
export async function stopWatchingPosition(id: string): Promise<DeletePositionResult> {
  try {
    await apiDeleteOnchainPosition(id)
    return { ok: true }
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect("/auth/refresh?next=/dashboard/onchain")
    }
    if (err instanceof ApiError) {
      const b = err.body as { error?: string } | null
      return { ok: false, error: b?.error ?? `api_error_${err.status}` }
    }
    return { ok: false, error: "network_error" }
  }
}

export interface RefreshSnapshotResult {
  ok: boolean
  snapshot?: PoolSnapshot
  error?: string
}

// live pool panel re-fetch (public endpoint) for optional polling
export async function refreshPoolSnapshot(poolId: string): Promise<RefreshSnapshotResult> {
  try {
    const snapshot = await getPoolSnapshot(poolId)
    return { ok: true, snapshot }
  } catch {
    return { ok: false, error: "snapshot_unavailable" }
  }
}
