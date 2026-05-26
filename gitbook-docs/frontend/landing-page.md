# Landing Page

`frontend` is the public web entrypoint. The landing page at `/` is the primary acquisition surface as of M8.

## Sections

The home page is a Next.js App Router page composed of the following sections, in order:

1. **nav** — sticky top bar with the distro tv wordmark and a primary CTA
2. **hero** — above-the-fold hook, install command, and terminal preview
3. **channels** — CH 01 NEWS and CH 02 MARKETS detail, plus coming-soon channel cards
4. **how-it-works** — three-step explainer (install → hooks fire → slots surface)
5. **control** — quiet hours, watchlist, and alert configuration highlights
6. **install** — full install command block and post-install note
7. **footer** — brand block + tagline, social icon links (X, WhatsApp, GitHub), link columns, copyright

Below-fold sections are dynamically imported with SSR enabled.

## Component Map

All landing components live in `frontend/components/landing/`:

| file                       | description                                 |
| -------------------------- | ------------------------------------------- |
| `nav.tsx`                  | top navigation bar                          |
| `hero-section.tsx`         | above-the-fold hero                         |
| `terminal-tv.tsx`          | animated terminal preview widget            |
| `channels-section.tsx`     | channels detail section                     |
| `channel-card.tsx`         | card for a live channel (CH 01, CH 02)      |
| `coming-channels-card.tsx` | placeholder card for upcoming channels      |
| `how-it-works-section.tsx` | three-step explainer                        |
| `control-section.tsx`      | quiet hours / watchlist / alerts highlights |
| `install-section.tsx`      | install CTA section                         |
| `install-command.tsx`      | copyable curl command block                 |
| `footer.tsx`               | brand + socials + link columns + meta bar   |

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

The surface noun is **channels**. The two launch channels are:

- **CH 01 NEWS** — HN, TechCrunch, Bloomberg, Reuters headlines
- **CH 02 MARKETS** — watchlist tickers with sparklines

Additional channels are surfaced as coming-soon cards on the landing page.

## Copy & Voice

Voice is **terse, minimal, lowercase-leaning, terminal-flavored** — but every line must be **concrete**, not clever-for-its-own-sake. A cold visitor must be able to answer "what is this / why do I want it" inside the hero. Avoid GPT-vague tropes (e.g. "the signal, not the noise/timeline", "catches the idle moment") and riddles that hide the product.

Lead with **channels** as the noun; name news + your watchlist as the concrete payload (not the two-tangent "news AND markets" framing pivoted away from in M8).

Canonical copy (keep these in sync if you touch the components):

| surface          | copy                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| hero H1          | Channels for your agent's idle minutes.                                                                                                                          |
| hero sub         | News and your watchlist, ambient in your terminal.                                                                                                               |
| meta title       | Distro TV — the channel that runs while your agent codes                                                                                                         |
| meta description | A terminal channel surface that plays tech news and your market watchlist while your AI agent works — gone the instant you type. Two channels live, more queued. |
| CH 01 title      | Top stories.                                                                                                                                                     |
| CH 02 title      | Your watchlist, while you wait.                                                                                                                                  |
| coming-channels  | Next on the dial.                                                                                                                                                |
| footer tagline   | Channels for your agent's idle minutes.                                                                                                                          |

Stay tool-agnostic in product copy ("your agent", not "Claude").

## Preview Treatments

The channel-card previews are differentiated so each reads as its own channel (not a clone of the hero terminal). Gated on `TerminalTV`'s `preview` variant so the hero `card` variant is untouched:

- **NEWS** — editorial brief: accent source kicker, emphasized lead headline, ruled stories
- **MARKETS** — data-grid: `sym / last / chg / 7d` header row above the rows

The coming-channels card renders a dim "channel lineup" of dashed stubs (CH number + name + `queued` tag), echoing the hero's dashed "coming" chip language.

## Operational Notes

- no waitlist route — the pre-pivot waitlist (`/api/waitlist`) was deprecated post-M1 and is no longer present
- the landing page does not talk to any backend at load time (static + edge-rendered)
- Vercel Analytics event tracking can be added at the section level if acquisition metrics are needed
