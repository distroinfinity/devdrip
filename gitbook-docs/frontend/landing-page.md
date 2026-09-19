# Landing Page

`frontend` is the public web entrypoint. The landing page at `/` is the primary acquisition surface as of M8.

## Sections

The home page is a Next.js App Router page composed of the following sections, in order:

1. **nav** — sticky top bar; anchors: the shift, how it works, rules, advertisers
2. **hero** — the exchange headline, install command, and the interactive terminal demo (first fold). nothing sits above the H1
3. **shift** — work moved to the agent, attention stayed put; four-cell stat grid (directional, footnoted as unaudited)
4. **lineage** — a ledger of media and the ad markets they grew; the last row's market cell is a hatched empty slot reading `nothing yet`
5. **sides** — people / surfaces / advertisers, each with an honest plain-text status (`live`, `terminal live, more next`, `planned`)
6. **terminal** — surface 01: three numbered beats (a true sequence) and a compact row of the `dtv` commands that work today
7. **rules** — five rules as a plain list (not numbered); under the last one ("the slot isn't only for ads") sit the CH 01 / CH 02 cards and the coming-channels card, fed with live data
8. **advertisers teaser** — "a new surface to buy", links to `/advertisers`
9. **install** — full install command block and the "what does this script do?" details
10. **footer** — brand block + tagline, social icon links (X, WhatsApp, GitHub), link columns, copyright

`/advertisers` (`frontend/app/advertisers/page.tsx`) is the advertiser-facing page: hero ("Reach developers while their agent works.", status `distro exchange · pilot`), why this inventory, how bidding will work (tagged `planned`), surfaces roadmap, three disabled "coming soon" campaign buttons (text labels only — no third-party logos), and an honest "today" status line. No forms, no backend; the only CTA is a `mailto:`.

### Motion

The hero terminal demo is the **only** autoplaying motion on the landing page. No fade-and-slide-up entrance wrappers on sections. Hover and focus feedback on interactive elements stays.

### Terminal demo (`terminal-demo.tsx`)

A client component that loops three states — agent working → slot showing → you're typing:

- the slot appears the instant the agent starts working (no grace phase, matching `GRACE_PERIOD_MS = 0`) and is drawn like the real CLI panel: three rows behind an indigo bar (`AD` badge + advertiser + per-view amount, copy, click URL + `est. today`)
- it rotates to a second ad after ~4s (the product's real rotation is 12s; the demo compresses it and never prints a timing number it fakes), and `est. today` counts up by one view
- the input line is a real, labelled, focusable `<input>`. the first keystroke removes the slot in a single commit — no exit animation — and the readout shows the **measured** time from the keystroke's event timestamp to the first frame painted without the slot (`cleared in N ms`). if nobody types, the loop types for them
- one 100ms clock drives the loop; it advances only while the demo is in view (IntersectionObserver) and the tab is visible
- `prefers-reduced-motion`: no loop, the static "slot showing" frame; typing still clears it
- the log and status-line areas have fixed heights, so nothing shifts when the slot appears or clears. below `sm` the click URL ellipsizes — inside this illustration only; the real panel never truncates it
- the frame stays dark in both themes

## Component Map

All landing components live in `frontend/components/landing/`:

| file                       | description                                                 |
| -------------------------- | ----------------------------------------------------------- |
| `nav.tsx`                  | top navigation bar                                          |
| `hero-section.tsx`         | above-the-fold hero                                         |
| `terminal-demo.tsx`        | interactive terminal demo in the hero (the one moving part) |
| `shift-section.tsx`        | the shift: copy + stat grid                                 |
| `lineage-section.tsx`      | medium / surface / market ledger with the empty slot        |
| `sides-section.tsx`        | three sides of the exchange with status text                |
| `terminal-section.tsx`     | surface 01: three beats + working `dtv` commands            |
| `rules-section.tsx`        | five rules; channel cards as evidence under the last        |
| `channel-card.tsx`         | card for a live channel (CH 01, CH 02)                      |
| `coming-channels-card.tsx` | placeholder card for upcoming channels                      |
| `terminal-tv.tsx`          | static terminal widget (news / markets / sponsored blocks)  |
| `advertisers-teaser.tsx`   | exchange teaser linking to `/advertisers`                   |
| `install-section.tsx`      | install CTA section                                         |
| `install-command.tsx`      | copyable curl command block                                 |
| `footer.tsx`               | brand + socials + link columns + meta bar                   |

## Brand Tokens

Design system: `@distrotv/design-system` v5.

| token            | value          |
| ---------------- | -------------- |
| display font     | Space Mono     |
| body font        | DM Sans        |
| data font        | JetBrains Mono |
| accent           | indigo         |
| background motif | dot-grid       |
| themes           | light + dark   |

## Install Vector

The primary install command shown on the landing page:

```sh
curl -fsSL https://get.distrotv.xyz/install.sh | sh
```

`install.sh` lives at `frontend/public/install.sh` (single source of truth) and is served from GitHub Pages at `get.distrotv.xyz` via `.github/workflows/deploy-install.yml` — off Vercel's platform firewall, which JS-challenges `curl`. Vercel keeps a fallback copy at `distrotv.xyz/install.sh`. See [CLI Releases](../cli/releases.md) for what the installer does, how releases are built, and why the installer is hosted off Vercel.

## OG / Twitter Cards

- `frontend/app/opengraph-image.tsx` — OG card, 1200×630, light palette
- `frontend/app/twitter-image.tsx` — Twitter `summary_large_image` card, 1200×675, dark palette
- `frontend/lib/og/render.tsx` — shared `next/og` renderer both routes call; takes a theme + size

Fonts are **bundled** from `frontend/lib/og/fonts/*.ttf` (static Space Mono 400 + JetBrains Mono 700) and loaded via `fetch(new URL(..., import.meta.url))` — **not** fetched from Google Fonts at request time. The old per-request font fetch pushed render time to ~4.5s, past the X/Twitter crawler timeout, so the card silently fell back to a no-image summary. Bundled fonts render in ~0.1s. Satori has no static-asset network dependency now, so the card is deterministic.

Gotcha: satori drops a bare `<br/>` between text nodes (jams words together) — multi-line headlines must use explicit per-line `<div style={{display:'flex'}}>` children.

## Positioning

Distro is **the ad exchange for AI agent surfaces**. The landing page tells that story rather than selling a benefit: every medium grew an ad market → agents created a new attention surface (the wait) → nothing serves it → Distro is the open exchange for it → the terminal is the first surface, and it is live. Channels appear as one of the rules ("the slot isn't only for ads"), never as the headline.

Money is always labeled **estimated**; earnings are "estimates until payouts open". No payment-method language anywhere on the landing surface.

The two launch channels are:

- **CH 01 NEWS** — HN, TechCrunch, Bloomberg, Reuters headlines
- **CH 02 MARKETS** — watchlist tickers with sparklines

Additional channels are surfaced as coming-soon cards on the landing page.

## Copy & Voice

Voice is **plain, observational, confident, sentence case**. It should read like infrastructure, not a consumer offer. Every line must be concrete; a cold visitor must be able to answer "what is this" inside the hero.

- lead with the exchange and the story (medium → market → agents have none → Distro)
- never pitch "get paid", and never lead with a benefit
- never surface product defaults such as "ads on by default" — that is a setting, not part of the story
- status tags must be honest: `live` / `next` / `planned`. never imply bidding or self-serve exists
- avoid templated tells: an all-caps eyebrow above every heading (only keep a label that carries information the heading doesn't), one accented word in a headline, `→` appended to links and buttons, middle-dot strings everywhere
- number things only when they are a true sequence (the three terminal beats are; the three sides and the five rules are not)
- left-align everything; keep body measure under ~70 characters

Canonical copy (keep these in sync if you touch the components):

| surface             | copy                                                                                                                                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hero H1             | The ad exchange for AI agent surfaces.                                                                                                                                                                    |
| hero sub            | Agents do the work now; people wait and watch. That wait is a new attention surface, and nothing serves it yet. Distro is building the open exchange that does, starting in the terminal.                 |
| hero CTA label      | Run the first surface                                                                                                                                                                                     |
| hero facts          | Opt-in audience. 70% goes to the viewer. Gone when you type.                                                                                                                                              |
| demo title bar      | surface 01 — terminal (left), live (right)                                                                                                                                                                |
| meta title          | Distro TV — the ad exchange for AI agent surfaces                                                                                                                                                         |
| meta description    | AI agents do the work while people wait. Distro is the open exchange for that attention: slots inside agent tools, an opted-in audience, and revenue shared with the viewer. First surface: the terminal. |
| shift H2            | Work moved to the agent. Attention stayed put.                                                                                                                                                            |
| lineage H2          | Every medium grew an ad market.                                                                                                                                                                           |
| sides H2            | Three sides, one slot.                                                                                                                                                                                    |
| terminal H2         | Surface 01: the terminal.                                                                                                                                                                                 |
| terminal sub        | Works with Claude Code today. More agent tools next.                                                                                                                                                      |
| rules H2            | Rules the exchange runs on.                                                                                                                                                                               |
| advertisers H2      | A new surface to buy.                                                                                                                                                                                     |
| install H2          | Run the first surface.                                                                                                                                                                                    |
| CH 01 title         | Top stories.                                                                                                                                                                                              |
| CH 02 title         | Your watchlist, while you wait.                                                                                                                                                                           |
| coming-channels     | Next on the dial.                                                                                                                                                                                         |
| footer tagline      | The ad exchange for AI agent surfaces.                                                                                                                                                                    |
| /advertisers H1     | Reach developers while their agent works.                                                                                                                                                                 |
| /advertisers status | distro exchange · pilot                                                                                                                                                                                   |

Stay tool-agnostic in product copy ("your agent", not "Claude"). The one exception is compatibility: the terminal section's sub-line and the install sub-line name Claude Code, because that is what the first surface works with today.

## Preview Treatments

The channel-card previews are differentiated so each reads as its own channel (not a clone of the hero terminal). Gated on `TerminalTV`'s `preview` variant so the `card` variant (used on `/advertisers`) is untouched:

- **NEWS** — editorial brief: accent source kicker, emphasized lead headline, ruled stories
- **MARKETS** — data-grid: `sym / last / chg / 7d` header row above the rows

The coming-channels card renders a dim "channel lineup" of dashed stubs (CH number + name + `queued` tag).

## Operational Notes

- no waitlist route — the pre-pivot waitlist (`/api/waitlist`) was deprecated post-M1 and is no longer present
- the landing page fetches public market + news data server-side (revalidated) for the channel cards; it does not talk to our backend at load time
- Vercel Analytics event tracking can be added at the section level if acquisition metrics are needed
