# Auth Architecture

Distro TV uses **GitHub OAuth** as the single sign-in path. There is no anonymous mode and no email/password fallback — every CLI device and every dashboard session is bound to a real `users` row identified by `github_id`.

## Surfaces

- **CLI** (`distro init`) — long-polls the API after kicking off OAuth in the browser. Persists a `device.<secret>` bearer to `~/.distro/config.json`.
- **Dashboard** (`/sign-in`, `/setup`) — owns the OAuth browser dance. Sets a `distrotv_session` JWT cookie scoped to `.distrotv.xyz`.
- **Admin** (`admin.distrotv.xyz`) — same cookie; access gated by the user's GitHub primary email being in `ADMIN_EMAILS`.

## Pair-code flow (CLI ↔ browser handshake)

The pair code is an opaque ticket. It is **not** bound to a device until OAuth completes. Lifecycle in Redis:

```
POST /devices/pair-init    → pair:<code> = pending      (TTL 10 min)
POST /auth/github/complete → pair:<code> = ready { … }  (when pair was passed)
GET  /devices/pair-poll    → del — single-use consume
```

## GitHub OAuth flow

```
1.  CLI: POST /devices/pair-init                      → { code, setupUrl }
2.  CLI: open(setupUrl)                               → browser hits /setup
3.  Browser: GET /auth/github/start?pair=<code>       (dashboard route)
       — generates csrf nonce N
       — redis: state:<sha256(N)> = { pair, next } (TTL 10 min)
       — sets gh_oauth_csrf cookie = N
       — 302 to github.com/login/oauth/authorize?state=N
4.  User authorizes on github.com
5.  Browser: GET /auth/github/callback?code=<gh>&state=N  (dashboard route)
       — verify cookie N == query N
       — getdel state:<sha256(N)> from redis
       — POST /auth/github/complete (s2s, x-internal-secret) to API
       — set distrotv_session cookie; 302 to /setup/channels or /dashboard
6.  API: POST /auth/github/complete
       — exchange gh code for access_token
       — fetch /user + /user/emails (pick primary verified)
       — upsert users by github_id
       — if pair: create device, mint device.secret, mark pair ready
       — return { sessionJwt, user, pairBound }
7.  CLI: GET /devices/pair-poll?code=<code>
       — long-poll until ready or 410 expired
       — write ~/.distro/config.json
```

## Env vars

| Var                          | Owner           | Notes                                    |
| ---------------------------- | --------------- | ---------------------------------------- |
| `GITHUB_OAUTH_CLIENT_ID`     | API + dashboard | One OAuth app per environment (dev/prod) |
| `GITHUB_OAUTH_CLIENT_SECRET` | API only        | Never exposed to dashboard runtime       |
| `GITHUB_OAUTH_REDIRECT_URI`  | API + dashboard | Dashboard URL (`/auth/github/callback`)  |
| `API_INTERNAL_SECRET`        | API + dashboard | Shared secret on s2s calls               |
| `JWT_SECRET`                 | API + dashboard | Both sign + verify session JWTs          |

## Ownership boundary

- **API** owns: `users`, `devices`, pair-code lifecycle, OAuth-state lifecycle, GitHub token exchange, session JWT minting.
- **Dashboard** owns: cookie management (`distrotv_session`, `gh_oauth_csrf`, `distrotv_pair`), the OAuth browser dance, OAuth route handlers (`/auth/github/start`, `/auth/github/callback`).
- **CLI** owns: pair-code initiation, long-poll, local config persistence.

## Error codes

| Code                  | Meaning                                       |
| --------------------- | --------------------------------------------- |
| `pair_init_failed`    | Backend couldn't seed pair entry (redis down) |
| `pair_expired`        | Pair code TTL elapsed or already consumed     |
| `oauth_csrf_failed`   | State cookie missing or hash mismatch         |
| `oauth_state_expired` | State TTL elapsed                             |
| `oauth_user_denied`   | User clicked Cancel on GitHub                 |
| `no_verified_email`   | GitHub returned no verified primary email     |
| `github_rate_limited` | 429 from github.com                           |
| `github_unavailable`  | 5xx or network error from github.com          |
| `device_unknown`      | Bearer device.<secret> not in DB              |
| `session_expired`     | JWT TTL elapsed                               |
| `not_admin`           | Auth ok but email not in ADMIN_EMAILS         |

## Out of scope (deferred)

- Refresh tokens / GitHub token rotation — we don't store the GitHub access_token after callback.
- Multi-account on CLI — single-account model. Switching = `distro logout` + `distro init`.
- Session revocation UI / "sign out everywhere".
- Account deletion endpoint.
