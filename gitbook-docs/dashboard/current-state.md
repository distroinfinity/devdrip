# Dashboard Current State

`packages/dashboard` exists as a separate Next.js app, but it is still a shell.

## What Exists

- App Router structure
- root layout
- one page component
- local env example with `NEXT_PUBLIC_API_URL`

## Current UI

The only page renders:

```text
DevDrip Dashboard
```

The layout sets:

- title: `DevDrip Dashboard`
- description: `earnings, analytics, preferences, wallet`

## What Does Not Exist Yet

- auth flow
- API data fetching
- earnings views
- analytics views
- preferences UI
- wallet UI
- payout history

## Engineering Takeaway

Treat this package as a valid app boundary, not a finished product area. It is the right place to build dashboard work next, but there is almost no feature code here yet.
