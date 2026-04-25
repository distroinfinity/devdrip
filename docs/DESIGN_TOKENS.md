# Dev Drip — Design Tokens v1.2

**All tokens as CSS custom properties. Monochrome + Electric Indigo accent at 8 touchpoints.**

---

## CSS Variables

```css
/* ============================================
   DEV DRIP DESIGN TOKENS v1.2
   "Industrial Paper" + Electric Indigo accent
   ============================================ */

:root {
  /* ---- Fonts ---- */
  --font-display: "Space Mono", monospace;
  --font-body: "DM Sans", system-ui, -apple-system, sans-serif;
  --font-data: "JetBrains Mono", monospace;

  /* ---- Type Scale ---- */
  --t-hero: 48px;
  --t-h1: 36px;
  --t-h2: 28px;
  --t-h3: 22px;
  --t-h4: 18px;
  --t-body: 16px;
  --t-body-s: 14px;
  --t-caption: 12px;
  --t-micro: 11px;
  --t-data-l: 32px;
  --t-data-m: 20px;
  --t-data-s: 14px;
  --t-data-xs: 12px;

  /* ---- Line Heights ---- */
  --lh-tight: 1.1;
  --lh-snug: 1.2;
  --lh-normal: 1.35;
  --lh-relaxed: 1.5;
  --lh-loose: 1.6;

  /* ---- Font Weights ---- */
  --fw-regular: 400;
  --fw-medium: 500;
  --fw-semibold: 600;
  --fw-bold: 700;

  /* ---- Letter Spacing ---- */
  --ls-tight: -0.03em;
  --ls-snug: -0.02em;
  --ls-normal: 0em;
  --ls-wide: 0.02em;
  --ls-wider: 0.06em;
  --ls-widest: 0.08em;

  /* ---- Spacing (4px base) ---- */
  --sp-1: 4px;
  --sp-2: 8px;
  --sp-3: 12px;
  --sp-4: 16px;
  --sp-5: 20px;
  --sp-6: 24px;
  --sp-8: 32px;
  --sp-10: 40px;
  --sp-12: 48px;
  --sp-16: 64px;
  --sp-20: 80px;

  /* ---- Border Radius ---- */
  --r-none: 0px;
  --r-sm: 4px;
  --r-md: 8px;
  --r-lg: 12px;
  --r-pill: 9999px;

  /* ---- Transitions ---- */
  --ease-micro: 100ms ease-out;
  --ease-fast: 150ms ease-out;
  --ease-default: 200ms ease-in-out;
  --ease-smooth: 300ms cubic-bezier(0.16, 1, 0.3, 1);
  --ease-slow: 400ms cubic-bezier(0.16, 1, 0.3, 1);
  --ease-vanish: 120ms ease-in; /* instant-out for ad dismissal */

  /* ---- Z-Index ---- */
  --z-base: 0;
  --z-above: 10;
  --z-dropdown: 100;
  --z-sticky: 200;
  --z-overlay: 300;
  --z-modal: 400;
  --z-toast: 500;

  /* ---- Grid ---- */
  --grid-columns: 12;
  --grid-gutter: 16px;
  --grid-max: 1200px;
  --content-max: 680px;

  /* ---- Dot Grid ---- */
  --dot-size: 1px;
  --dot-spacing: 16px;
}

/* ============================================
   LIGHT MODE (Default)
   "Paper" — warm white, dark ink
   ============================================ */

[data-theme="light"],
:root {
  /* Paper (Backgrounds) */
  --bg-primary: #f7f6f3;
  --bg-secondary: #eeedea;
  --bg-surface: #ffffff;
  --bg-surface-hover: #f2f1ee;
  --bg-inset: #e8e7e3;
  --bg-elevated: #ffffff;

  /* Ink (Text) */
  --ink-primary: #0e0e11;
  --ink-secondary: #5c5c66;
  --ink-tertiary: #9c9ca5;
  --ink-faint: #c5c5bf;
  --ink-inverse: #f7f6f3;

  /* Rules (Borders & Structure) */
  --rule-default: #ddddd8;
  --rule-subtle: #eeeeea;
  --rule-strong: #c5c5bf;
  --dot-grid-color: #d4d4ce;

  /* Emphasis (Active States) */
  --em-primary: #0e0e11;
  --em-hover: #2a2a2f;
  --em-surface: #f0efeb;
  --em-glow: rgba(79, 70, 229, 0.1);

  /* Accent — Electric Indigo (8 touchpoints only) */
  --accent-color: #4f46e5;
  --accent-hover: #4338ca;
  --accent-surface: rgba(79, 70, 229, 0.06);
  --accent-glow: rgba(79, 70, 229, 0.15);
  --accent-muted: #c7d2fe;

  /* Status (Rare — like Nothing's red dot) */
  --status-negative: #c13438;
  --status-negative-surface: #fcf0f0;
  --status-caution: #b8860b;
  --status-caution-surface: #fbf5e6;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(14, 14, 17, 0.04);
  --shadow-md: 0 2px 8px rgba(14, 14, 17, 0.06);
  --shadow-lg: 0 8px 24px rgba(14, 14, 17, 0.08);
}

/* ============================================
   DARK MODE
   "Terminal" — near-black, bright ink
   ============================================ */

[data-theme="dark"] {
  /* Terminal (Backgrounds) */
  --bg-primary: #0a0a0c;
  --bg-secondary: #111113;
  --bg-surface: #18181b;
  --bg-surface-hover: #1f1f23;
  --bg-inset: #0f0f11;
  --bg-elevated: #222226;

  /* Ink (Text) */
  --ink-primary: #ededf0;
  --ink-secondary: #8a8a94;
  --ink-tertiary: #5c5c66;
  --ink-faint: #3a3a40;
  --ink-inverse: #0a0a0c;

  /* Rules */
  --rule-default: #27272b;
  --rule-subtle: #1e1e22;
  --rule-strong: #3a3a40;
  --dot-grid-color: #1e1e22;

  /* Emphasis */
  --em-primary: #ededf0;
  --em-hover: #d0d0d6;
  --em-surface: #1f1f23;
  --em-glow: rgba(99, 102, 241, 0.12);

  /* Accent — Electric Indigo */
  --accent-color: #6366f1;
  --accent-hover: #818cf8;
  --accent-surface: rgba(99, 102, 241, 0.08);
  --accent-glow: rgba(99, 102, 241, 0.2);
  --accent-muted: #312e81;

  /* Status */
  --status-negative: #e8585c;
  --status-negative-surface: #2a1214;
  --status-caution: #e0a020;
  --status-caution-surface: #2a2210;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md: 0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.4);
}

/* ============================================
   DOT-GRID PATTERN
   ============================================ */

.dd-dot-grid {
  background-image: radial-gradient(
    circle,
    var(--dot-grid-color) var(--dot-size),
    transparent var(--dot-size)
  );
  background-size: var(--dot-spacing) var(--dot-spacing);
}

.dd-dot-grid-subtle {
  opacity: 0.25;
}
.dd-dot-grid-wide {
  --dot-spacing: 24px;
}
```

---

## Tailwind Config Extension

```js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Mono"', "monospace"],
        body: ['"DM Sans"', "system-ui", "sans-serif"],
        data: ['"JetBrains Mono"', "monospace"],
      },
      colors: {
        paper: {
          50: "#FFFFFF",
          100: "#F7F6F3",
          200: "#EEEDEA",
          300: "#E8E7E3",
          400: "#DDDDD8",
          500: "#C5C5BF",
          600: "#9C9CA5",
          700: "#5C5C66",
          800: "#0E0E11",
        },
        ink: {
          50: "#EDEDF0",
          100: "#8A8A94",
          200: "#5C5C66",
          300: "#3A3A40",
          400: "#27272B",
          500: "#1F1F23",
          600: "#18181B",
          700: "#111113",
          800: "#0A0A0C",
        },
        negative: { DEFAULT: "#C13438", surface: "#FCF0F0" },
        caution: { DEFAULT: "#B8860B", surface: "#FBF5E6" },
        indigo: {
          DEFAULT: "#4F46E5",
          50: "#EEF2FF",
          100: "#E0E7FF",
          200: "#C7D2FE",
          300: "#A5B4FC",
          400: "#818CF8",
          500: "#6366F1",
          600: "#4F46E5",
          700: "#4338CA",
          800: "#3730A3",
          900: "#312E81",
        },
      },
      borderRadius: {
        none: "0px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        pill: "9999px",
      },
      fontSize: {
        hero: ["48px", { lineHeight: "1.1", letterSpacing: "-0.03em" }],
        h1: ["36px", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        h2: ["28px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        h3: ["22px", { lineHeight: "1.3" }],
        h4: ["18px", { lineHeight: "1.35" }],
        body: ["16px", { lineHeight: "1.6" }],
        "body-s": ["14px", { lineHeight: "1.5" }],
        caption: ["12px", { lineHeight: "1.4" }],
        "data-l": ["32px", { lineHeight: "1.1" }],
        "data-m": ["20px", { lineHeight: "1.2" }],
        "data-s": ["14px", { lineHeight: "1.3" }],
        "data-xs": ["12px", { lineHeight: "1.3" }],
      },
    },
  },
}
```

---

## Google Fonts Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap"
  rel="stylesheet"
/>
```

---

## Quick Reference: Font Usage

| Context                | Font           | Weight |
| ---------------------- | -------------- | ------ |
| Page title             | Space Mono     | 700    |
| Section heading        | Space Mono     | 700    |
| Card title             | DM Sans        | 600    |
| Body text              | DM Sans        | 400    |
| UI label / button      | DM Sans        | 500    |
| Dollar amount (large)  | JetBrains Mono | 700    |
| Dollar amount (inline) | JetBrains Mono | 500    |
| Table data             | JetBrains Mono | 400    |
| Code / address         | JetBrains Mono | 400    |
| Category label         | DM Sans        | 600    |
| Tiny data label        | JetBrains Mono | 500    |

## How Money Is Communicated

Primarily through typography; accent highlights the earning moment:

1. **JetBrains Mono Bold** — the typeface IS the money signal
2. **Font weight** — 700 for amounts, 400 for context
3. **Tabular figures** — `font-variant-numeric: tabular-nums`
4. **Electric Indigo accent** — the +$0.03 delta renders in `--accent`, glow uses `--accent-glow`
5. **Animation** — the +$0.03 fade-in + indigo glow pulse
6. **Density** — Bloomberg-style tight data layouts
7. **The "$" symbol** — universal, needs no color code

## Accent Tokens — Electric Indigo

| Token              | Light                   | Dark                     | Usage                          |
| ------------------ | ----------------------- | ------------------------ | ------------------------------ |
| `--accent-color`   | #4F46E5                 | #6366F1                  | CTA bg, delta text, link hover |
| `--accent-hover`   | #4338CA                 | #818CF8                  | Button hover                   |
| `--accent-surface` | rgba(79, 70, 229, 0.06) | rgba(99, 102, 241, 0.08) | Subtle tinted bg               |
| `--accent-glow`    | rgba(79, 70, 229, 0.15) | rgba(99, 102, 241, 0.2)  | Glow pulse, focus rings        |
| `--accent-muted`   | #C7D2FE                 | #312E81                  | Subtle borders                 |
