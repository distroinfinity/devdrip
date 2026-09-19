# World Identity

> **Deprecated.** This page describes the World ID + walletAuth flow being removed in the agent-treasury pivot. See [Agent Treasury Pivot](agent-treasury-pivot.md). After the pivot lands, identity becomes Privy + optional GitHub on Base Sepolia. World code is preserved on the `archive/world-integration` branch.

DevDrip binds three credentials per user before any USDC payout can happen:

1. **World Wallet address** — proves the user controls a payout destination, captured via MiniKit `walletAuth` (SIWE).
2. **World ID nullifier hash** — proves the user is a unique human, captured via IDKit (Device or Orb verification level).
3. **GitHub identity** — preserves the "verified developer" positioning, captured via GitHub OAuth.

All three are required for `users.signed_up_at` to flip from `NULL` to a timestamp. The Mini App signup wizard at `/m/signup` walks the user through them in order; refresh resumes from the next-undone step (state derived from which `users.*` columns are still null).

## Why three?

Each credential closes a different attack:

| Credential           | Defends against                                                 |
| -------------------- | --------------------------------------------------------------- |
| World Wallet address | claim flows that paste arbitrary 0x addresses (typo / phishing) |
| World ID nullifier   | bot farms / sybil signups that inflate the impression ledger    |
| GitHub OAuth         | non-developers signing up to drain the float                    |

The World ID action `devdrip-signup` is namespaced — same nullifier may legitimately appear under different actions in the future (e.g., `devdrip-claim-bonus`) without colliding.

## Storage

`users` table (relevant columns):

| Column                                             | Type                                         | Notes                                                                               |
| -------------------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------------- |
| `wallet_address`                                   | `varchar(42)` nullable, no unique constraint | bound at walletAuth verify                                                          |
| `nullifier_hash`                                   | `numeric(78,0) unique nullable`              | bound at world-id verify; NUMERIC(78,0) holds a 256-bit hash without precision loss |
| `verification_level`                               | `varchar(16)` nullable                       | `'device'` or `'orb'`                                                               |
| `github_id`, `github_login`, `email`, `avatar_url` | from existing schema                         | bound at github-oauth callback                                                      |
| `signed_up_at`                                     | `timestamptz` nullable                       | flipped to `now()` when all three above are bound                                   |

Plus the `nullifiers` table (anti-replay), keyed on the composite `(nullifier, action)`:

```sql
CREATE TABLE "nullifiers" (
  "nullifier" NUMERIC(78,0) NOT NULL,
  "action" TEXT NOT NULL,
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "verified_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY ("nullifier", "action")
);
```

The PK enforces "this nullifier has already been used for this action — reject the second attempt." The API surfaces this as a `409 nullifier_already_used` error.

## Session model

Two distinct credentials, one shared JWT secret, different audiences:

| Surface                        | Where it lives                                                 | Audience claim    | Path scope      |
| ------------------------------ | -------------------------------------------------------------- | ----------------- | --------------- |
| Mini App session               | HttpOnly cookie `dd_miniapp`                                   | `devdrip-miniapp` | `Path=/miniapp` |
| Bearer token (CLI + dashboard) | `~/.devdrip/auth.json` (CLI) or `dd_access` cookie (dashboard) | `devdrip`         | n/a             |

The audience check in `jose.jwtVerify` cryptographically separates the two surfaces — a Mini App cookie cannot authorize a Bearer call to `/me/*` and vice versa, even though both JWTs are signed with the same `JWT_SECRET`.

The Mini App cookie is path-scoped to `/miniapp` (not the frontend page route `/m`). Browsers send a cookie only to URLs whose path matches the cookie's `Path` attribute by RFC 6265 prefix-match rules. Frontend Mini App pages at `/m/*` make `fetch()` calls to `/api/miniapp/*` which Next.js rewrites to the backend `/miniapp/*` (preserving the path for cookie-attach purposes). Same-origin throughout.

## CLI ↔ Mini App pairing

`devdrip login` mints a pair code via `POST /cli/pair`, prints an ASCII QR, and long-polls `GET /cli/pair/:code`. The user scans with World App's camera, the deeplink opens the DevDrip Mini App with `?link=<code>`, and the signup wizard's final step shows "Link this CLI?" → `POST /miniapp/cli-link/:code` atomically binds the pair session to the Mini App user and mints a CLI session token.

The CLI session token is **byte-equivalent** to today's `/auth/exchange` response shape:

- Same JWT secret (`JWT_SECRET`)
- Same audience (`devdrip`, NOT the Mini App audience)
- Same claims (`sub`, `github_login`, `iss`, `aud`, `iat`, `exp`)
- Same refresh token shape (rotation-tracked in `refresh_tokens` table)
- Same persisted `~/.devdrip/auth.json` config v3 shape

This is load-bearing: the daemon's `prefs-sync` loop reads the token from `~/.devdrip/auth.json` and calls `GET /me/preferences` with `Authorization: Bearer <token>`. The new `devdrip login` flow must produce a token the daemon accepts unchanged. PR2's integration test `paired-token-prefs-sync.test.ts` gates this guarantee — gated behind `DEVDRIP_INTEGRATION_RUN=1` so it doesn't run in regular CI without setup.

## walletAuth nonce

`POST /miniapp/wallet-auth/nonce` mints a 32-byte hex nonce stored in Upstash with 5-minute TTL (key `walletauth:nonce:<nonce>`). The Mini App passes it to `MiniKit.commandsAsync.walletAuth({ nonce })`, which returns a SIWE payload signed by the user's World Wallet. `POST /miniapp/wallet-auth/verify` consumes the nonce atomically (`getdel`), calls `verifySiweMessage()` from `@worldcoin/minikit-js`, and on success upserts the user by recovered address (or returns the existing user if the wallet was previously bound).

Single-use is critical: a leaked nonce is useless after one verify attempt regardless of how it leaked.

## Returning users

After PR4: `POST /miniapp/wallet-auth/verify` for a returning wallet (already bound to a user) issues a Mini App session JWT with `signup: true` immediately, skipping the redundant `/miniapp/signup/complete` round-trip. The client routes them straight to `/m/wallet`.

## Operator notes

- `WORLD_APP_ID` env var (Railway + Vercel) — register the Mini App at https://developer.world.org. Used in deeplink URLs (frontend) and forwarded to MiniKit on the client. The same value is exposed to clients via `NEXT_PUBLIC_WORLD_APP_ID`.
- `WORLD_ID_RP_ID` env var (Railway) — used in the cloud verify URL `POST /api/v4/verify/{rp_id}`. Per the World 4.0 docs, prefer `rp_id`; the verify endpoint still accepts `app_id` for back-compat, so the API falls back to `WORLD_APP_ID` when `WORLD_ID_RP_ID` is unset.
- `WORLD_ID_ACTION` env var — defaults to `devdrip-signup`. Override only for staging environments to avoid colliding with prod nullifiers.
- Hot wallet ops (faucets, refill, drain): see [World Chain Stack](chain.md).
