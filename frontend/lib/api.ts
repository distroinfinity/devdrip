import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { ACCESS_COOKIE } from "./cookies"
import { API_URL } from "./env"

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
    message?: string
  ) {
    super(message ?? `api_error_${status}`)
  }
}

export class UnauthenticatedError extends Error {
  constructor() {
    super("unauthenticated")
  }
}

// server-side fetch for RSC / route handlers.
// reads dd_access cookie, adds Authorization: Bearer, and throws on 401 so the
// caller can redirect to /auth/refresh. all other non-2xx responses throw ApiError.
export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = cookies().get(ACCESS_COOKIE)?.value

  const headers = new Headers(init.headers)
  headers.set("Accept", "application/json")
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  })

  if (res.status === 401) {
    throw new UnauthenticatedError()
  }

  const text = await res.text()
  const body = text ? safeJson(text) : null

  if (!res.ok) {
    throw new ApiError(res.status, body)
  }

  return body as T
}

// server-component shortcut: on 401 redirect to /auth/refresh.
// callers that want to branch on error should use apiFetch directly.
export async function apiFetchOrRefresh<T>(
  path: string,
  nextPath: string,
  init: RequestInit = {}
): Promise<T> {
  try {
    return await apiFetch<T>(path, init)
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      redirect(`/auth/refresh?next=${encodeURIComponent(nextPath)}`)
    }
    throw err
  }
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
