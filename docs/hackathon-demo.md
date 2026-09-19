# Hackathon demo — 3 minutes

Pitch in one line: **developers watch a terminal for minutes at a time while their agent
works. We turn that attention into ad inventory, pay the developer for it, and open it up as
an exchange anyone can bid on.**

## Before you present

- [ ] `docker ps` shows `devdrip-postgres` healthy (port 5434)
- [ ] API up: `curl -s localhost:3011/health` → `"status":"ok"` (`pnpm --filter @distrotv/api dev`)
- [ ] Web up on 3010 (`cd frontend && pnpm exec next dev -p 3010`), signed in at `/dashboard`
- [ ] `dtv status` → `ads: on`, daemon running. If the CLI was rebuilt: `dtv daemon stop`
- [ ] Revenue page already has history so the chart is not empty (let an agent run for a few
      minutes beforehand)
- [ ] `dtv preferences` → feeds = ads only, so the opt-in step has something to show
- [ ] Terminal font size up; window at least 100 columns wide so the ad link fits on one row
- [ ] Browser tabs ready: landing `/`, `/dashboard/revenue`, `/advertisers`

## Script

1. **The thesis (25s)** — landing page. Read the headline, then scroll to the lineage table: print, broadcast, web, mobile all grew an ad market; agents have "nothing yet". Type into the hero terminal so the slot clears — "this is the whole product in one gesture."
2. **The product (60s)** — in Claude Code, give the agent a real multi-step task.
   - A sponsored slot appears in the status line the moment the agent takes over.
   - Point at `+$0.0070` and `est. today`. It rotates every 12 seconds.
   - **⌘-click the link in the ad.** The advertiser opens in the browser. No second terminal,
     no key capture.
   - Start typing: the ad is gone. It never competes with you for the keyboard.
3. **The money (40s)** — `/dashboard/revenue`. Estimated balance moved; ads seen, clicks, CTR,
   served vs seen; **Payouts — coming soon**. Say plainly: sandbox ads, estimated CPM.
4. **The choice (30s)** — `dtv preferences` → feeds → add News. The terminal now alternates
   ad / headline. "Don't want ads? Tune to a channel. Same surface."
5. **The vision (30s)** — `/advertisers`. Terminal today; IDE panels, agent UIs and CLI tools
   next. Open bidding like web display or a billboard; bring campaigns from existing ad
   accounts. "The ad exchange for AI agent surfaces."

## If something breaks

| Symptom                       | Fix                                                                                 |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| No ad in the status line      | open a **new** Claude Code session; check `dtv status`; `tail ~/.distro/daemon.log` |
| Ad shows, numbers do not move | `dtv sync --force`, reload the revenue page                                         |
| Carbon has no fill            | nothing to do: house ads fill every slot                                            |
| ⌘-click does nothing          | `dtv open` from any terminal opens the ad on screen                                 |
| API restarted mid-demo        | nothing to do: deliveries live in Postgres                                          |

## Honest answers for judges

- The ads are Carbon's sandbox zone plus demo creatives. No advertiser is paying yet.
- Earnings are estimates at a configurable CPM with a 70% developer share. Payouts are not built.
- The exchange (bidding, self-serve, account import) is the roadmap. What is built is the
  supply side end to end: serving, viewability, clicks, attribution, reporting.
