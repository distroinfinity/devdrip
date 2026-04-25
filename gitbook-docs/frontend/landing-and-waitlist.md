# Landing And Waitlist

`frontend` is the public web entrypoint today.

## What Exists

- landing page at `/`
- metadata assets such as OG image, Twitter image, icon, sitemap, and robots
- waitlist submission route at `/api/waitlist`
- email template for beta access confirmation

## Landing Page Composition

The home page is a Next.js App Router page built from section components.

Current sections:

- inline navbar
- floating nav
- hero
- dead time section
- how it works
- surfaces
- your rules
- payment rail
- worldwide
- waitlist
- footer

Notes:

- below-fold sections are dynamically imported with SSR enabled
- comments in the page file still mark a few not-yet-built marketing sections

## Waitlist Flow

The waitlist route lives in `frontend/app/api/waitlist/route.ts`.

Request input:

- `email`
- `aiTools`
- `monthlySpend`
- `source`
- `_honey`

Validation and processing:

- reject invalid email
- coerce invalid source to `bottom`
- filter `aiTools` against allowed parent and sub-option values
- derive `spendTier` only from allowed spend options
- treat the honeypot field as fake-success for bots
- hash the client IP with `IP_HASH_SALT`
- apply in-memory rate limit of 5 requests per hour per hashed IP

Persistence:

- inserts into `waitlist`
- uses `ON CONFLICT (email) DO NOTHING`
- calculates queue position after insert or duplicate detection

Response shape:

```json
{
  "success": true,
  "duplicate": false,
  "position": 42,
  "message": "Request received."
}
```

Duplicate response:

```json
{
  "success": true,
  "duplicate": true,
  "position": 42,
  "message": "You've already requested access."
}
```

Error classes:

- `400 validation`
- `429 rate_limit`
- `500 server`

## Email Flow

After a successful new signup:

- render `BetaAccessEmail`
- send via Resend
- do not fail the request if email sending fails

If `RESEND_API_KEY` is not set:

- the route logs a warning and skips email sending

## Analytics

On successful client-side signup, `submitWaitlist()` lazily imports Vercel Analytics and tracks:

```text
Waitlist Signup
```

with the selected `source`.

## Operational Notes

- the waitlist route talks directly to Neon from `frontend`
- the route assumes a `waitlist` table exists in the database
- that table is not defined in the Drizzle schema under `packages/api`
- rate limiting is process-local and resets on redeploy

## Why This Matters

An engineer working on acquisition, onboarding, or early tester flows should start here first. The landing page and waitlist path are the most complete user-facing flow in the repo today.
