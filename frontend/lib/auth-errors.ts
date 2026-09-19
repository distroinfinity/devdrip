const MESSAGES: Record<string, string> = {
  invalid_state: "Login session expired. Try again.",
  missing_code: "GitHub didn't return a code. Try again.",
  auth_failed: "GitHub sign-in failed. Try again.",
  user_creation_failed: "Couldn't create your account. Reach out in support.",
  exchange_failed: "Couldn't complete sign-in. Try again.",
  exchange_invalid: "Session handshake was incomplete. Try again.",
  session_expired: "Your session expired. Please sign in again.",
  refresh_invalid: "Your session was invalid. Please sign in again.",
  network: "Couldn't reach the backend. Check your connection.",
  access_denied: "Sign-in cancelled.",
}

export function authErrorMessage(code: string | null | undefined): string | null {
  if (!code) return null
  return MESSAGES[code] ?? `Sign-in failed (${code}).`
}
