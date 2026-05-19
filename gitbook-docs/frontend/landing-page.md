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
7. **footer** — links and copyright

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
| `footer.tsx`               | page footer                                 |

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
curl -fsSL https://distrotv.xyz/install.sh | sh
```

`install.sh` lives at `frontend/public/install.sh` and is served as a static asset by Vercel. See [CLI Releases](../cli/releases.md) for what the installer does and how releases are built.

## OG / Twitter Cards

- `frontend/app/opengraph-image.tsx` — OG image (channels-first copy, indigo palette)
- `frontend/app/twitter-image.tsx` — Twitter summary_large_image card

Both are rendered via `@vercel/og` at request time.

## Positioning

The surface noun is **channels**. The two launch channels are:

- **CH 01 NEWS** — HN, TechCrunch, Bloomberg, Reuters headlines
- **CH 02 MARKETS** — watchlist tickers with sparklines

Additional channels are surfaced as coming-soon cards on the landing page.

## Operational Notes

- no waitlist route — the pre-pivot waitlist (`/api/waitlist`) was deprecated post-M1 and is no longer present
- the landing page does not talk to any backend at load time (static + edge-rendered)
- Vercel Analytics event tracking can be added at the section level if acquisition metrics are needed
