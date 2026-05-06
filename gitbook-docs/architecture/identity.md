# Identity & Auth

Distro TV uses an **anonymous-first** auth model. Every device gets a local identity at install time; email-bound user identity is an optional upgrade.

## Anonymous device flow (M1, automatic)

1. `distro init` generates a local 256-bit `device_secret` and POSTs to `/devices/register` (no auth required).
2. The API creates a `users` row (with `email: NULL`) and a `devices` row with the SHA-256 hash of the secret.
3. The CLI stores the raw secret in `~/.distro/config.json` and uses `Authorization: Bearer device.<secret>` for all subsequent API calls.

The user can use Distro TV indefinitely without ever signing in. Their preferences and reading list are scoped to their anonymous user.

## Magic-link sign-in (M2, optional upgrade)

When the user enters an email on `/setup` (or `/sign-in`):

1. Frontend POSTs to `/auth/magic-link/send` with `{email, pairingCode?}`.
2. API generates a 32-byte token, stores its SHA-256 hash in `magic_link_tokens` (15-min TTL, single-use), and emails the raw token via Resend.
3. User clicks the link → frontend `/auth/magic-link/verify` route extracts the token and POSTs to `/auth/magic-link/verify`.
4. API verifies the hash, finds-or-creates a user by email, and **if a `pairingCode` was present**: re-points the paired device's `user_id` to the email-bound user (deletes the now-orphan anonymous user if it has no other devices).
5. API issues a 7-day session JWT containing `{sub: userId, email}`.
6. Frontend sets the JWT in an HTTP-only cookie (`distrotv_session`).

The same JWT is the API's bearer auth — the frontend's cookie value is sent as `Authorization: Bearer <jwt>` to the API. No separate session abstraction.

## CLI ↔ Browser pairing

`distro init` calls `POST /devices/pair` (authed via the device bearer) to get a 10-min pairing code, then opens the browser at `/setup?pair=<code>`. The browser exchanges the code via `POST /auth/exchange-pair` (public) which returns a 7-day session JWT bound to the device's current (anonymous) user. The user can then sign in via magic-link to upgrade.

The pairing code lives in Redis (`pair:<code>` 10-min TTL). After exchange, a `pair-remember:<code>` entry (30-min TTL) lets the magic-link verify flow re-point the right device after the user clicks the email.

## Cross-device sync

Devices sharing the same `users.id` automatically share preferences via `GET /me/preferences`. When a user signs in via magic-link on a new device, the magic-link verify re-points that device to their email-bound user — and prefs immediately follow.

## Session model

| Surface    | Mechanism                                          | TTL    |
| ---------- | -------------------------------------------------- | ------ |
| Dashboard  | HTTP-only cookie `distrotv_session` (session JWT)  | 7 days |
| CLI/daemon | `Authorization: Bearer device.<secret>` (raw hash) | n/a    |

The dashboard middleware checks cookie presence at the Edge (no JWT crypto); `lib/session.ts`'s `getSession()` does full `jose` verification in server components.

## DB schema (M2 additions)

```sql
-- magic_link_tokens (migration 0011)
CREATE TABLE magic_link_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token_hash  TEXT NOT NULL UNIQUE,          -- SHA-256(raw_token)
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pairing_code TEXT,                          -- optional, from CLI handoff
  expires_at  TIMESTAMPTZ NOT NULL,           -- now() + 15 min
  consumed_at TIMESTAMPTZ                     -- set on first use (single-use)
);

-- preferences.channel_mode values updated:
-- 'earn' → 'news', 'learn' → 'markets', 'both' → 'mix'
-- (migration 0011 + shared ChannelMode enum)
```

## Operator notes

- `RESEND_API_KEY` — required in production for magic-link emails; if absent the API logs the link in dev mode (no email sent).
- `JWT_SECRET` — signs all session JWTs. Rotate requires all existing sessions to be invalidated (cookie cleared on next request).
- `REDIS_URL` (Upstash) — stores pairing codes (`pair:<code>`, 10-min TTL) and per-email rate-limit keys (`ml:rate:<email>`, 60-s TTL).
