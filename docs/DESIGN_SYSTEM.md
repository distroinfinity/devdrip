# Dev Drip — Design System & Brand Guide

**Version:** 1.2 — Electric Indigo Accent
**Last Updated:** February 2026

---

## 1. Brand Philosophy

### 1.1 The Core Tension (Our Secret Weapon)

Dev Drip lives at the intersection of three worlds that rarely touch:

```
FINTECH TRUST          DEV TOOL COOL          CRYPTO UTILITY
(Stripe, OpenFX)   x   (Nothing, Linear)   x   (Base, USDC)
      |                      |                      |
  Light-first           Industrial              Stablecoin
  Clean paper          Visible machinery        Not speculative
  Tabular data          Dot-matrix texture       Transparent rails
```

Most products pick one lane. We occupy all three — and the _tension_ between them IS the brand. A developer glancing at Dev Drip should feel: **"This is a serious financial tool that was designed by someone who actually uses a terminal."**

### 1.2 Brand Personality

**We are:**

- Precise, not flashy
- Industrial, not decorative
- Transparent about money (literally — every cent is visible)
- Terminal-native in spirit, even on a white background
- Cool the way a well-machined tool is cool — not the way a nightclub is cool

**We are NOT:**

- "Web3 bro" energy (no gradients-on-gradients, no token moonshot language)
- Generic SaaS (no purple gradients, no stock photo humans, no "reimagine your workflow")
- Scrappy startup (no hand-drawn illustrations, no playful bouncy animations)
- Crypto casino (no neon, no dark-only, no "to the moon" anything)

### 1.3 The Nothing Principle

Nothing Tech's genius was using dot-matrix typography from IBM mainframes to create psychological distance from every other phone brand. They made the _machinery visible_. Their product looks like it was built by engineers who are proud of the engineering.

Dev Drip applies the same principle: **the financial machinery is visible.** You see the USDC flowing. You see the CPM math. You see the ad lifecycle states. We don't hide behind smooth abstractions — we expose the system, and that exposure IS the trust signal. Developers trust what they can inspect.

### 1.4 The "Paper & Ink" Metaphor

Our light-first design uses the metaphor of **financial paper** — the physical documents that money has always been printed on. Warm white backgrounds, dark ink for text, precise tabular layouts. This grounds the crypto element in something tangible and ancient: printed money, account ledgers, financial statements.

In dark mode, the metaphor shifts to **the terminal** — the developer's native habitat. The same precision, the same data density, but now rendered on dark surfaces like a trading floor monitor at 2am.

### 1.5 The Monochrome Conviction (with one exception)

Stripe processes trillions in payments without using green. Nothing makes hardware that literally costs money without using green. Green-for-money is a crutch. It's what crypto scam sites do.

**Our conviction: money is conveyed through precision, not color.**

- JetBrains Mono Bold tabular figures SAY "financial" without any color help
- The +$0.03 counter animation FEELS like earning without being green
- Bloomberg terminals are monochrome and they move billions daily
- The "$" symbol is the universal money signal — it doesn't need a color code

Our palette is intentionally monochrome with warm undertones. The entire product could be printed in black and white on good paper and still feel exactly like itself. Color exists only for functional status states (errors, warnings) and is used with the same restraint Nothing uses for their red indicator dot — tiny, purposeful, almost invisible.

**The Electric Indigo exception.** Like Nothing's single red indicator dot, we allow one accent color — Electric Indigo (`#4F46E5` light / `#6366F1` dark) — at exactly 8 surgical touchpoints: primary CTA buttons, earnings delta text, earnings glow pulse, active indicator dots, text link hovers, focus rings, progress bar fill, and version badge border. This is a warmer, purple-shifted indigo distinct from Base's pure blue. If you desaturate the page, only these 8 elements lose color. Everything else remains fully monochrome.

---

## 2. Target Audience Profile

### 2.1 Primary: The Pragmatic Dev (age 22-35)

- Uses AI coding tools daily (Claude Code, Cursor, Copilot)
- Runs dark terminals but appreciates clean web UIs
- Has opinions about fonts and color schemes
- Subscribes to Hacker News, follows dev Twitter/X
- Uses or admires: Linear, Raycast, Warp, Vercel, Nothing
- Quietly interested in crypto when it's _useful_ (stablecoins > memecoins)
- Allergic to scams, hype, and empty promises
- Respects Stripe's design, Coinbase's engineering, Base's simplicity
- Price-sensitive enough to care about $10-25/month in earnings

### 2.2 Secondary: The Emerging Market Builder (age 20-30)

- Based in India, Brazil, Southeast Asia, Africa
- AI tool costs are a real percentage of their income
- Mobile-first internet experience but codes on desktop
- Values transparency about money above all else
- Less concerned with "cool factor," more concerned with "does it actually pay"
- Needs the product to feel trustworthy from first pixel

### 2.3 What Both Groups Share

- They will inspect the source code of your landing page
- They judge products by design quality (Linear insight: "if they care about these details, they care about their product")
- They have zero tolerance for dark patterns or hidden catches
- They want to understand HOW the money flows, not just THAT it flows

---

## 3. Design Language: "Industrial Paper"

### 3.1 Overview

"Industrial Paper" combines:

1. **Paper**: Light, warm surfaces. The tactile quality of a well-printed financial document. Generous whitespace. Precise alignment.
2. **Industrial**: Visible structure. Dot-matrix textures. Monospaced data. Grid lines as design elements, not hidden scaffolding. The beauty of exposed systems.
3. **Precision**: Money is communicated through typeface weight, tabular alignment, and motion — never through color.

### 3.2 Visual Hierarchy

```
Layer 0: Paper (Background)         — warm white / near-black
Layer 1: Surface (Cards, Panels)    — white / dark surface
Layer 2: Structure (Grids, Borders) — visible dot-grids, hairline rules
Layer 3: Ink (Text, Data)           — high-contrast monochrome
Layer 4: Emphasis (Active States)   — weight change, contrast shift, subtle glow
```

### 3.3 The Dot-Matrix Pattern

Our signature texture. A subtle dot grid that appears across surfaces — in card backgrounds, page sections, and as a watermark-like element. It references:

- IBM mainframe printouts (Nothing's inspiration)
- Financial paper security patterns (like check paper or currency)
- Terminal phosphor pixels

In **light mode**: Very faint warm gray dots on warm white. Barely visible. Feels like high-quality paper grain.
In **dark mode**: Slightly more visible dots. Feels like terminal phosphor.

---

## 4. Color System

### 4.1 Philosophy

**Monochrome is the foundation.** The interface is a spectrum of warm grays with one surgical accent — Electric Indigo — applied at exactly 8 touchpoints. The brand IS the precision, the typography, the dot-grid texture. Just as Nothing's brand is recognized by its monochrome + single red dot, Dev Drip is recognized by its monochrome + tabular numbers + indigo accent moments.

Color appears for functional states (error, warning) and at 8 accent touchpoints. Both are used like Nothing uses their red dot — sparingly, small, purposeful.

### 4.2 Light Mode Palette

**Backgrounds (Warm Paper)**
| Token | Hex | Usage |
|----------------------|-----------|---------------------------------------------|
| `--bg-primary` | #F7F6F3 | Page background (warm paper) |
| `--bg-secondary` | #EEEDEA | Alternate sections, grouped areas |
| `--bg-surface` | #FFFFFF | Cards, elevated panels, inputs |
| `--bg-surface-hover` | #F2F1EE | Card / row hover state |
| `--bg-inset` | #E8E7E3 | Code blocks, inset panels, recessed areas |
| `--bg-elevated` | #FFFFFF | Modals, dropdowns (same as surface) |

**Ink (Text)**
| Token | Hex | Usage |
|----------------------|-----------|---------------------------------------------|
| `--ink-primary` | #0E0E11 | Headlines, body text, primary data |
| `--ink-secondary` | #5C5C66 | Descriptions, labels, secondary info |
| `--ink-tertiary` | #9C9CA5 | Placeholders, disabled, captions |
| `--ink-faint` | #C5C5BF | Decorative text, watermarks |
| `--ink-inverse` | #F7F6F3 | Text on dark backgrounds |

**Structure (Borders & Grid)**
| Token | Hex | Usage |
|----------------------|-----------|---------------------------------------------|
| `--rule-default` | #DDDDD8 | Card borders, dividers |
| `--rule-subtle` | #EEEEEA | Faint separators, table rows |
| `--rule-strong` | #C5C5BF | Emphasized borders, active input |
| `--dot-grid` | #D4D4CE | Dot-matrix pattern fill |

**Emphasis (Active / Earning States)**
| Token | Hex | Usage |
|----------------------|-----------|---------------------------------------------|
| `--em-primary` | #0E0E11 | CTAs, active toggles, key actions |
| `--em-hover` | #2A2A2F | Button hover |
| `--em-surface` | #F0EFEB | Subtle highlight behind active items |
| `--em-glow` | rgba(14,14,17,0.06) | Subtle warm glow for earning states |

**Functional Status (used like Nothing's red dot — tiny and rare)**
| Token | Hex | Usage |
|----------------------|-----------|---------------------------------------------|
| `--status-negative` | #C13438 | Errors, destructive actions, loss |
| `--status-negative-surface` | #FCF0F0 | Error background tint |
| `--status-caution` | #B8860B | Warnings, approaching limits |
| `--status-caution-surface` | #FBF5E6 | Warning background tint |
| `--status-active` | #0E0E11 | Active/online indicator (just ink!) |

### 4.3 Dark Mode Palette

**Backgrounds (Terminal)**
| Token | Hex | Usage |
|----------------------|-----------|---------------------------------------------|
| `--bg-primary` | #0A0A0C | Page background |
| `--bg-secondary` | #111113 | Sections |
| `--bg-surface` | #18181B | Cards, panels |
| `--bg-surface-hover` | #1F1F23 | Hover state |
| `--bg-inset` | #0F0F11 | Code blocks, recessed areas |
| `--bg-elevated` | #222226 | Modals, dropdowns |

**Ink (Dark)**
| Token | Hex | Usage |
|----------------------|-----------|---------------------------------------------|
| `--ink-primary` | #EDEDF0 | Headlines, body text |
| `--ink-secondary` | #8A8A94 | Descriptions, labels |
| `--ink-tertiary` | #5C5C66 | Placeholders, disabled |
| `--ink-faint` | #3A3A40 | Decorative, watermarks |
| `--ink-inverse` | #0A0A0C | Text on light surfaces |

**Structure (Dark)**
| Token | Hex | Usage |
|----------------------|-----------|---------------------------------------------|
| `--rule-default` | #27272B | Card borders |
| `--rule-subtle` | #1E1E22 | Faint separators |
| `--rule-strong` | #3A3A40 | Emphasized borders |
| `--dot-grid` | #1E1E22 | Dot-matrix pattern fill |

**Emphasis (Dark)**
| Token | Hex | Usage |
|----------------------|-----------|---------------------------------------------|
| `--em-primary` | #EDEDF0 | CTAs, key actions (white on dark) |
| `--em-hover` | #D0D0D6 | Button hover |
| `--em-surface` | #1F1F23 | Active item highlight |
| `--em-glow` | rgba(237,237,240,0.06) | Subtle glow for earning states |

**Functional Status (Dark)**
| Token | Hex | Usage |
|----------------------|-----------|---------------------------------------------|
| `--status-negative` | #E8585C | Errors |
| `--status-negative-surface` | #2A1214 | Error background |
| `--status-caution` | #E0A020 | Warnings |
| `--status-caution-surface` | #2A2210 | Warning background |
| `--status-active` | #EDEDF0 | Active indicator (just ink!) |

### 4.4 Accent — Electric Indigo

One accent, 8 touchpoints. Inspired by Nothing's single-color approach.

**Light Mode**
| Token | Value | Usage |
|----------------------|-----------------------------|--------------------------------------|
| `--accent-color` | #4F46E5 | CTA buttons, delta text, link hover |
| `--accent-hover` | #4338CA | Button hover state |
| `--accent-surface` | rgba(79, 70, 229, 0.06) | Subtle tinted background |
| `--accent-glow` | rgba(79, 70, 229, 0.15) | Earnings glow pulse, focus rings |
| `--accent-muted` | #C7D2FE | Subtle borders (version badge) |

**Dark Mode**
| Token | Value | Usage |
|----------------------|-----------------------------|--------------------------------------|
| `--accent-color` | #6366F1 | CTA buttons, delta text, link hover |
| `--accent-hover` | #818CF8 | Button hover state |
| `--accent-surface` | rgba(99, 102, 241, 0.08) | Subtle tinted background |
| `--accent-glow` | rgba(99, 102, 241, 0.2) | Earnings glow pulse, focus rings |
| `--accent-muted` | #312E81 | Subtle borders (version badge) |

**The 8 Accent Touchpoints (exhaustive)**

1. Primary CTA buttons (bg `--accent-color`, white text)
2. Earnings counter `+$0.03` delta text
3. Earnings counter glow pulse (box-shadow)
4. Active/earning indicator dots (6px circle)
5. Text link hover states
6. Focus rings (keyboard a11y)
7. Progress bar fill
8. Version badge border (subtle)

### 4.5 How Money Is Communicated

This is the most important section in the design system.

**1. Typography IS the signal**

- All dollar amounts use JetBrains Mono Bold
- The bold weight alone creates visual hierarchy without color
- Tabular figures align numbers in columns — this reads "financial" instantly
- The "$" prefix is the universal money symbol

**2. Weight creates hierarchy**

- Earning amounts: JetBrains Mono 700 (bold) at `--ink-primary`
- Secondary data: JetBrains Mono 400 (regular) at `--ink-secondary`
- The weight difference is the visual signal, not color

**3. Animation + accent creates moment**

- The +$0.03 counter appears in `--accent-color` with a subtle translateY + opacity animation
- A brief indigo glow (box-shadow with `--accent-glow`) pulses once
- The running total ticks up digit-by-digit
- The combination of motion + accent color IS the reward feedback

**4. Density creates context**

- Financial data is presented in tight, tabular Bloomberg-style layouts
- Multiple data points (CPM, impressions, earned, balance) create a "trading desk" feel
- The density of well-formatted numbers communicates "serious money" better than any green badge

**5. The dot-grid pattern creates paper**

- Our signature texture makes surfaces feel like financial paper
- Combined with monospaced numbers, this creates an unmistakable "financial document" feel
- The texture does the work that color would do in a lesser design system

### 4.6 Color Rules

1. **The interface is monochrome + one accent.** If you desaturate a screenshot, only 8 accent touchpoints lose color.
2. **One accent, 8 touchpoints.** Electric Indigo appears only at the 8 listed touchpoints. Not a hex value slapped everywhere.
3. **Status colors are rare and small.** Like Nothing's red dot — a 6px indicator, not a full badge.
4. **CTAs use accent fill.** `--accent` background with white text. The single most visible accent moment.
5. **No gradients anywhere.** Flat, precise, mechanical surfaces only.
6. **Dark mode is a recolor, not a redesign.** Same hierarchy, same weights, only values invert. Accent shifts from `#4F46E5` to `#6366F1`.
7. **The warm paper tone (#F7F6F3) is intentional.** Pure white (#FFFFFF) is cold and clinical. Our warmth says "paper, ledger, document" — not "hospital, tech, sterile."

---

## 5. Typography System

### 5.1 Font Stack

| Role        | Font           | Weight Range | Fallback              |
| ----------- | -------------- | ------------ | --------------------- |
| **Display** | Space Mono     | 400, 700     | monospace             |
| **Body**    | DM Sans        | 400–700      | system-ui, sans-serif |
| **Data**    | JetBrains Mono | 400–700      | monospace             |

### 5.2 Why These Fonts

**Space Mono** (Display/Headlines): Monospaced headlines are the "Nothing move." Industrial, mechanical, instantly recognizable. Says "built by engineers" without trying.

**DM Sans** (Body/UI): Geometric sans by Colophon Foundry. Bridges Stripe readability and Nothing precision. Warm enough for light paper, crisp enough for dark terminal.

**JetBrains Mono** (Numbers/Data/Code): Purpose-built for developers. Tabular figures make every $14.72 align like a Bloomberg terminal. The typeface IS the money signal.

### 5.3 Type Scale

| Token         | Size | Line Height | Weight | Font           | Usage                    |
| ------------- | ---- | ----------- | ------ | -------------- | ------------------------ |
| `--t-hero`    | 48px | 1.1         | 700    | Space Mono     | Landing page hero only   |
| `--t-h1`      | 36px | 1.15        | 700    | Space Mono     | Page titles              |
| `--t-h2`      | 28px | 1.2         | 700    | Space Mono     | Section headings         |
| `--t-h3`      | 22px | 1.3         | 700    | DM Sans        | Sub-section headings     |
| `--t-h4`      | 18px | 1.35        | 600    | DM Sans        | Card titles, labels      |
| `--t-body`    | 16px | 1.6         | 400    | DM Sans        | Body text                |
| `--t-body-s`  | 14px | 1.5         | 400    | DM Sans        | Secondary body           |
| `--t-caption` | 12px | 1.4         | 500    | DM Sans        | Captions, badges         |
| `--t-micro`   | 11px | 1.3         | 500    | JetBrains Mono | Tiny data labels         |
| `--t-data-l`  | 32px | 1.1         | 700    | JetBrains Mono | Large earnings display   |
| `--t-data-m`  | 20px | 1.2         | 500    | JetBrains Mono | Medium data/numbers      |
| `--t-data-s`  | 14px | 1.3         | 400    | JetBrains Mono | Inline data, table cells |
| `--t-data-xs` | 12px | 1.3         | 400    | JetBrains Mono | Micro data               |

### 5.4 Typography Rules

1. **Headlines always Space Mono.** Non-negotiable brand recognition.
2. **Numbers always JetBrains Mono.** Even inside DM Sans paragraphs. `<span class="dd-data">$14.72</span>`.
3. **Space Mono never below 14px.** Falls apart at small sizes.
4. **Letter spacing for Space Mono**: -0.02em above 28px, -0.03em at 48px+.
5. **All financial figures: `font-variant-numeric: tabular-nums`.** Non-negotiable.
6. **No italics in Space Mono.** Use weight or opacity for emphasis.

---

## 6. Spacing, Layout & Radius

### 6.1 Spacing (4px base)

| Token     | Value | Usage                    |
| --------- | ----- | ------------------------ |
| `--sp-1`  | 4px   | Tight internal           |
| `--sp-2`  | 8px   | Icon gaps, compact       |
| `--sp-3`  | 12px  | Default internal padding |
| `--sp-4`  | 16px  | Standard gap             |
| `--sp-5`  | 20px  | Comfortable spacing      |
| `--sp-6`  | 24px  | Section padding          |
| `--sp-8`  | 32px  | Large gaps               |
| `--sp-10` | 40px  | Page section spacing     |
| `--sp-12` | 48px  | Major section breaks     |
| `--sp-16` | 64px  | Hero spacing             |
| `--sp-20` | 80px  | Maximum section spacing  |

### 6.2 Border Radius

| Token      | Value  | Usage                          |
| ---------- | ------ | ------------------------------ |
| `--r-none` | 0px    | Terminal surfaces, code blocks |
| `--r-sm`   | 4px    | Badges, small tags             |
| `--r-md`   | 8px    | Buttons, inputs, cards         |
| `--r-lg`   | 12px   | Large cards, modals            |
| `--r-pill` | 9999px | Pill badges, toggle tracks     |

### 6.3 Grid

- 12-column, 16px gutters
- Max content: 1200px / Max reading: 680px
- Breakpoints: 640 / 768 / 1024 / 1280 / 1536

---

## 7. Component Patterns

### 7.1 Buttons

**Primary (Accent Fill)**

- Both modes: bg `--accent-color`, text white (#FFFFFF)
- Hover: `--accent-hover`
- The single most visible accent touchpoint

**Ghost**

- Transparent bg, 1px `--rule-default` border, `--ink-primary` text
- Hover: `--bg-surface-hover` fill

**Text Button**

- No bg, no border. `--ink-secondary` text. Underline on hover.

**Disabled**: opacity 0.4, cursor not-allowed.

### 7.2 Cards

**Standard Card**: `--bg-surface`, 1px `--rule-default` border, 8px radius, 20px padding.

**Data Card**: Same + dot-grid background + left border 2px `--ink-primary` (not colored — just stronger ink).

**Terminal Card**: ALWAYS dark (#0E0E11), 0px radius (sharp), JetBrains Mono throughout.

### 7.3 Earnings Counter (Signature Component)

The most recognizable UI moment. Accent color marks the earning moment.

- Font: JetBrains Mono 700
- Main amount color: `--ink-primary`
- Delta badge (+$0.03) color: `--accent` — the signature indigo moment
- The "+$0.03" appears with: fade-in + translateY(-4px) over 250ms
- Brief glow: `box-shadow: 0 0 16px var(--accent-glow)` — indigo-tinted
- Hold 1.5s, fade out 150ms
- Running total ticks up digit-by-digit (80ms per digit)

### 7.4 Badges

**Standard**: bg `--bg-inset`, text `--ink-secondary`, DM Sans 500 11px, 4px radius.

**Active indicator**: A small filled circle (6px) at `--accent` + the word "Active" in `--ink-primary` weight 600. Like Nothing's red dot, but in indigo.

**Earning indicator**: A 6px circle at `--accent-color` with a subtle `accent-glow` pulse animation. The accent color + animation together create the earning signal.

### 7.5 Status Indicators

Errors and warnings are the ONLY places color appears. Used like Nothing's red dot:

- Tiny (6px dot or thin 2px left border on a card)
- Never as full background fills on large areas
- Always accompanied by clear text explanation

---

## 8. Iconography

- **Lucide** icon library (stroke-based, 1.5px at 24px)
- Monochrome: always `currentColor`
- No emoji anywhere
- Rounded caps/joins for approachability

---

## 9. Motion

### 9.1 Asymmetric: Slow In, Instant Out

Everything appears gradually but disappears instantly. This is both the PRD's <200ms ad-vanish requirement AND a design principle.

- **Appear**: 250-350ms, cubic-bezier(0.16, 1, 0.3, 1)
- **Vanish**: 120ms, ease-in

### 9.2 Earnings Animation

No color. Pure motion and weight:

1. "+$0.03" fades in, translates up 4px (250ms)
2. Brief warm glow pulse via box-shadow (200ms)
3. Hold 1.5s
4. Fade out (150ms)
5. Running total digits roll (80ms per digit)

### 9.3 Dot-Grid Heartbeat

On earning surfaces, the dot-grid subtly pulses in opacity (0.3 to 0.5) on a 3-second sine wave. Monochrome. Like machinery humming.

---

## 10. UI Library Mappings

### From MagicUI

Terminal, Number Ticker, Dot Pattern, Flickering Grid, Retro Grid, Border Beam, Shimmer Button, Animated Beam

### From Aceternity

Encrypted Text, Noise Background, ASCII Art, Moving Border, Dither Shader, Typewriter Effect, Code Block

---

## 11. The Anti-Scam Checklist

- [ ] Could this be a crypto scam landing page? (If any doubt, simplify)
- [ ] Is the palette monochrome + accent only? (Desaturate screenshot — only 8 accent touchpoints lose color)
- [ ] Does non-accent color appear ONLY for error/warning states?
- [ ] Is accent used at only the 8 designated touchpoints?
- [ ] Are earnings labeled as estimates?
- [ ] Is the USDC/Base relationship stated factually?
- [ ] Are numbers consistently formatted? (Always 2 decimal, tabular alignment)
- [ ] Would a Stripe or Nothing designer put this in their portfolio?

---

## 12. Ecosystem Relationship: Base & USDC

**Do:** Say "Powered by Base" factually, use official USDC logo for balances, reference low fees.

**Don't:** Imply endorsement, make UI look like Coinbase, use Base logo decoratively. Our Electric Indigo (#4F46E5) is intentionally distinct from Base's pure blue (#0000FF).

---

_The brand is the precision. The brand is the typography. The brand is the texture. One accent, eight touchpoints, and nothing more._
