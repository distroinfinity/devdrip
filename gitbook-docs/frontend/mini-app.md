# Mini App

> **Deprecated.** The Mini App and its `/m/*` routes are being removed in the agent-treasury pivot. See [Agent Treasury Pivot](../architecture/agent-treasury-pivot.md). Signup, wallet linking, and claim move to the standard dashboard at `/dashboard/*` with Privy auth.

The DevDrip Mini App lives at `frontend/app/m/*` as a route group inside the existing Next.js 14 app. It is the **canonical write surface** for chain-related actions: signup, wallet linking, and claim. Web dashboard (`/dashboard/*`) is read-only for chain state but write-capable for non-chain prefs.

## Why a route group, not a separate Next.js app

- Single deploy pipeline (Vercel)
- Shared design system (`@devdrip/design-system`)
- Shared auth helpers + API fetch lib
- Mini-App-specific HTTP headers (CSP for World App webview) handled by route-level layout, not app-level

## Layout + isInstalled gate

`frontend/app/m/layout.tsx` is a client component that:

1. On mount, calls `MiniKit.install(WORLD_APP_ID)`
2. Checks `MiniKit.isInstalled()` — true only inside World App's webview
3. If true: renders children
4. If false: renders `<OpenInWorldApp>` — a fallback landing page with QR + `worldapp://` deeplink + copy-link

This gate prevents server fetches in child server components (e.g., `/m/wallet` calls `/api/miniapp/me`) from hitting `401 missing_miniapp_session` on every regular-browser page-load.

## Same-origin proxy for the Mini App cookie

The Mini App session cookie `dd_miniapp` is scoped to `Path=/miniapp` (RFC 6265 prefix match). Frontend Mini App pages at `/m/*` make `fetch()` calls to `/api/miniapp/*`, and Next.js rewrites those URLs to the backend API:

```js
// frontend/next.config.mjs
async rewrites() {
  const apiBase = process.env.DISTRO_API_BASE_URL || "http://localhost:3001"
  return [
    { source: "/api/miniapp/:path*", destination: `${apiBase}/miniapp/:path*` },
    { source: "/api/me", destination: `${apiBase}/me` },
    { source: "/api/me/:path*", destination: `${apiBase}/me/:path*` },
  ]
}
```

Net effect: every API call is same-origin from the browser's perspective, the cookie attaches automatically, and there's no CORS / `SameSite=None` gymnastics.

## Signup wizard

`/m/signup` is a server component that calls `/api/miniapp/me` and renders the next-undone step:

| `users.*` column                  | Step rendered                                       |
| --------------------------------- | --------------------------------------------------- |
| `wallet_address IS NULL`          | Step 1 — `<WalletAuthStep>`                         |
| `nullifier_hash IS NULL`          | Step 2 — `<WorldIdStep>`                            |
| `github_login IS NULL`            | Step 3 — `<GithubStep>`                             |
| All bound, `signed_up_at IS NULL` | `<CompleteStep>` (POSTs `/miniapp/signup/complete`) |
| `signed_up_at IS NOT NULL`        | `<CompleteStep>` (idempotent)                       |

Each step is a client component that interacts with MiniKit / GitHub OAuth and POSTs the result to the backend. Refresh resumes from the next-undone step automatically (no client-side step state needed).

CLI link branch: if URL has `?link=ABC-123` (from CLI QR scan), the `<CompleteStep>` renders `<LinkCliCard>` instead of redirecting to `/m/wallet`. The user taps "Link this CLI" → `POST /miniapp/cli-link/:code` → success state with "Return to your terminal."

## Wallet page

`/m/wallet` is a server component that:

1. Calls `/api/miniapp/me` — auth gate (redirect to `/m/signup` if no session)
2. Calls `/api/me/balance` — current balance breakdown
3. Calls `/api/me/payouts?limit=20` — recent payout rows
4. Renders `<BalanceCard>` (with `<ClaimButton>`) + `<PayoutHistory>`

`<ClaimButton>` is a client component:

- Generates `crypto.randomUUID()` for `Idempotency-Key`
- POSTs `/api/me/payouts/claim` with the header
- Polls `GET /api/me/payouts/:id` every 3s for up to 60s
- On `confirmed` / `failed`, calls `router.refresh()` so the server component re-renders with the latest state

`<PayoutHistory>` is shared with the web dashboard `/dashboard/wallet` page (`frontend/components/wallet/payout-history.tsx`). Status pills: pending=amber, processing=blue, confirmed=green (with WorldScan tx link), failed=red.

## Server-side fetch with cookie forwarding

Server components can't carry browser cookies automatically. Mini App pages forward them explicitly:

```ts
import { headers } from "next/headers"

const h = headers()
const cookieHeader = h.get("cookie") ?? ""
const proto = h.get("x-forwarded-proto") ?? "http"
const host = h.get("host") ?? "localhost:3000"
const origin = `${proto}://${host}`

const r = await fetch(`${origin}/api/miniapp/me`, {
  headers: { cookie: cookieHeader },
  cache: "no-store",
})
```

In production (Vercel + Railway split), the rewrite goes through Vercel's edge so this works the same as locally.

## Web dashboard wallet page (`/dashboard/wallet`)

Read-only counterpart. Same `<PayoutHistory>` component. Uses the existing dashboard session (Bearer cookie) instead of the Mini App cookie. Shows:

- Wallet address (truncated `0x1234…abcd`)
- Balance + lifetime + pending
- Payout history table
- "Claim in DevDrip Mini App" QR CTA (link payload opens the Mini App)
- Onboarding banner if `signed_up_at` is null ("Sign up in World App to start receiving USDC")

The dashboard page is gated by the existing `frontend/middleware.ts` (matcher `/dashboard/:path*`) which redirects unauthed users to `/sign-in`.

## Local dev

Mini App pages can be hit at `http://localhost:3000/m/*` from a regular browser to see the `<OpenInWorldApp>` fallback (MiniKit isn't installed in regular browsers). Real Mini App testing requires:

- ngrok tunnel exposing the local frontend
- A separate "dev" Mini App registered at https://developer.world.org pointing at the ngrok URL
- The dev `WORLD_APP_ID` set as `NEXT_PUBLIC_WORLD_APP_ID`

## Env vars

| Var                        | Where                | Notes                                                                                                      |
| -------------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_WORLD_APP_ID` | Vercel (and `.env`)  | Public — embedded in the client bundle. From developer.world.org.                                          |
| `DISTRO_API_BASE_URL`      | Vercel (server-only) | Backend API URL for the next.config.mjs rewrites.                                                          |
| `MINIAPP_BASE_URL`         | Railway API          | Frontend URL where the GitHub OAuth callback redirects back to. Should match the production frontend host. |
