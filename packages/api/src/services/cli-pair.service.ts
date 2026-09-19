// M2 rewrites this with magic-link auth.
// cli_pair_sessions and refresh_tokens schemas dropped in Batch 5 (Task 19).
// These stubs keep the router compiling; real logic lands in M2.

export interface CreatedPairSession {
  code: string
  linkUrl: string
  qrPayload: string
  expiresAt: Date
}

export type PairFetchResult =
  | { kind: "pending" }
  | { kind: "expired" }
  | { kind: "linked"; token: string; refreshToken: string; user: PairUserPayload }

export interface PairUserPayload {
  id: string
  githubLogin: string | null
  email: string
  avatarUrl: string | null
}

// M2 replaces with magic-link pairing
export async function createPairSession(): Promise<CreatedPairSession> {
  throw new Error("cli pair session not available — M2 rewrites with magic-link auth")
}

// M2 replaces with magic-link token exchange
export async function fetchPairTokens(_code: string): Promise<PairFetchResult> {
  throw new Error("cli pair token fetch not available — M2 rewrites with magic-link auth")
}

// M2 replaces with magic-link link flow
export async function linkPairSession(_code: string, _userId: string): Promise<PairUserPayload> {
  throw new Error("cli pair link not available — M2 rewrites with magic-link auth")
}
