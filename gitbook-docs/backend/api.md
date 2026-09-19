# Backend API

`packages/api` is the current backend runtime.

## App Structure

- framework: Express 5
- auth: bearer JWT
- cookies: used only for GitHub OAuth state
- CORS: credentials enabled, origins from `ALLOWED_ORIGINS`
- security headers: Helmet
- logs: Pino + `pino-http`
- rate limit: Upstash Redis, fail-open on Redis errors

## Startup Behavior

On process start:

- load env from `dotenv/config`
- probe DB
- probe Redis
- exit if DB probe fails
- continue if Redis probe fails
- listen on `PORT`
- track open sockets for graceful shutdown

## Routes

## `GET /health`

Purpose:
health endpoint with component-level DB and Redis status.

Behavior:

- not behind the global limiter
- probes DB and Redis on request
- returns `200` if DB is healthy
- returns `503` if DB is unhealthy
- returns overall `status: "ok"` only when DB and Redis are both healthy
- returns overall `status: "degraded"` when Redis is unhealthy but DB is healthy

Response shape:

```json
{
  "status": "ok",
  "uptime": 123.45,
  "timestamp": "2026-04-15T00:00:00.000Z",
  "components": {
    "db": { "status": "ok" },
    "redis": { "status": "ok" }
  }
}
```

## `GET /auth/github/redirect`

Purpose:
start GitHub OAuth.

Behavior:

- rate limited by `authLimiter`
- generates random state
- stores state in `gh_oauth_state` cookie
- redirects to GitHub with `read:user user:email`

## `GET /auth/github/callback`

Purpose:
complete GitHub OAuth and prepare token exchange.

Behavior:

- validates query `state` against cookie
- validates `code`
- exchanges code for GitHub token
- fetches GitHub profile
- fetches primary language using recent repos
- resolves email from profile, email API, or GitHub noreply fallback
- upserts user by `githubId`
- inserts a refresh token row
- stores access token and refresh token behind a one-time Redis code with 60 second TTL
- redirects to `CLIENT_REDIRECT_URL?code=<exchangeCode>`

Failure redirects:

- `?error=invalid_state`
- `?error=missing_code`
- `?error=user_creation_failed`
- `?error=auth_failed`

## `POST /auth/exchange`

Purpose:
exchange one-time Redis code for bearer tokens.

Request body:

```json
{
  "code": "hex-string"
}
```

Success response:

```json
{
  "token": "jwt",
  "refresh_token": "hex-string"
}
```

Errors:

- `400 missing_code`
- `401 invalid_or_expired_code`

## `POST /auth/refresh`

Purpose:
rotate refresh token and issue a new access token.

Request body:

```json
{
  "refresh_token": "hex-string"
}
```

Behavior:

- rate limited by `refreshLimiter`
- hashes the provided refresh token
- atomically revokes the current row if it is still active
- detects token reuse and revokes the full token family
- rejects expired tokens
- inserts successor refresh token in the same family
- issues a new access token using stored user identity

Success response:

```json
{
  "token": "jwt",
  "refresh_token": "new-hex-string"
}
```

Errors:

- `401 missing_refresh_token`
- `401 invalid_refresh_token`
- `401 refresh_token_expired`
- `401 refresh_token_reuse_detected`
- `500 internal_error`

Engineering note:

- the code already flags a remaining transactional race in refresh rotation

## `POST /auth/logout`

Purpose:
revoke all non-revoked refresh tokens for the authenticated user.

Auth:

- requires bearer token

Response:

```json
{
  "ok": true
}
```

## `GET /me`

Purpose:
return the authenticated user identity from the JWT.

Auth:

- requires bearer token

Success response:

```json
{
  "userId": "uuid",
  "githubLogin": "login"
}
```

Errors:

- `401 missing_token`
- `401 token_expired`
- `401 invalid_token`

## `POST /devices`

Purpose:
register or refresh a device record for the authenticated user.

Auth:

- requires bearer token

Request body:

```json
{
  "machineIdHash": "64-char hex",
  "os": "darwin | linux | win32",
  "ideType": "terminal | vscode | cursor",
  "deviceName": "optional string"
}
```

Behavior:

- validates machine ID hash format
- validates allowed OS values
- validates allowed IDE values
- validates device name length when present
- inserts a new device or updates an existing row on `userId + machineIdHash`
- updates `lastHeartbeat` on every registration
- only overwrites `deviceName` if the caller explicitly sends it

Success response:

```json
{
  "device": {
    "id": "uuid",
    "userId": "uuid",
    "deviceName": "host-name",
    "os": "darwin",
    "ideType": "terminal",
    "lastHeartbeat": "2026-04-15T00:00:00.000Z",
    "createdAt": "2026-04-15T00:00:00.000Z"
  }
}
```

Errors:

- `400 invalid_machine_id_hash`
- `400 invalid_os`
- `400 invalid_ide_type`
- `400 invalid_device_name`
- `500 internal_error`

## Rate Limit Tiers

- `global`: 100 requests / 60s by IP
- `public`: 20 requests / 60s by IP
- `auth`: 10 requests / 60s by IP
- `refresh`: 20 requests / 60s by IP
- `user`: 60 requests / 60s by user ID
- `sensitive`: 3 requests / 1h by user ID
- `advertiser`: 30 requests / 60s by user ID

Headers set on limited routes:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset`
- `Retry-After` on `429`

## Test Coverage Today

Current API tests cover:

- `/health` status shape
- absence of global rate-limit headers on `/health`
- key Helmet headers
- CORS allow and block behavior
- auth guard behavior for `/me`
- basic error cases for `/auth/exchange`
- basic error case for `/auth/refresh`
