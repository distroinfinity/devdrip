import { cache } from "react"
import { cookies } from "next/headers"
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./cookies"
import { apiFetch, UnauthenticatedError } from "./api"

export interface SessionUser {
  id: string
  githubLogin: string
  email: string
  avatarUrl: string | null
}

// raw /me response — includes extra fields we don't surface in the header yet
interface MeResponse {
  id: string
  githubLogin: string
  email: string
  avatarUrl: string | null
  reposCount?: number
  primaryLanguage?: string | null
  walletAddress?: string | null
  streakDays?: number
  createdAt?: string
}

// memoized per request so multiple server components can call this without
// fan-out to the backend
export const getServerUser = cache(async (): Promise<SessionUser | null> => {
  const jar = cookies()
  if (!jar.get(ACCESS_COOKIE)?.value && !jar.get(REFRESH_COOKIE)?.value) {
    return null
  }

  try {
    const me = await apiFetch<MeResponse>("/me")
    return {
      id: me.id,
      githubLogin: me.githubLogin,
      email: me.email,
      avatarUrl: me.avatarUrl,
    }
  } catch (err) {
    if (err instanceof UnauthenticatedError) return null
    throw err
  }
})
