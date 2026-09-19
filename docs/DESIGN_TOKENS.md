# Dev Drip — Design Tokens v1.1 (Monochrome)

**All tokens as CSS custom properties. Pure monochrome — no brand color.**

---

## CSS Variables

```css
/* ============================================
   DEV DRIP DESIGN TOKENS v1.1
   Monochrome — "Industrial Paper"
   ============================================ */

:root {
  /* ---- Fonts ---- */
  --font-display: 'Space Mono', monospace;
  --font-body: 'DM Sans', system-ui, -apple-system, sans-serif;
  --font-data: 'JetBrains Mono', monospace;

  /* ---- Type Scale ---- */
  --t-hero:    48px;
  --t-h1:      36px;
  --t-h2:      28px;
  --t-h3:      22px;
  --t-h4:      18px;
  --t-body:    16px;
  --t-body-s:  14px;
  --t-caption: 12px;
  --t-micro:   11px;
  --t-data-l:  32px;
  --t-data-m:  20px;
  --t-data-s:  14px;
  --t-data-xs: 12px;

  /* ---- Line Heights ---- */
  --lh-tight:    1.1;
  --lh-snug:     1.2;
  --lh-normal:   1.35;
  --lh-relaxed:  1.5;
  --lh-loose:    1.6;

  /* ---- Font Weights ---- */
  --fw-regular:  400;
  --fw-medium:   500;
  --fw-semibold: 600;
  --fw-bold:     700;

  /* ---- Letter Spacing ---- */
  --ls-tight:  -0.03em;
  --ls-snug:   -0.02em;
  --ls-normal:  0em;
  --ls-wide:    0.02em;
  --ls-wider:   0.06em;
  --ls-widest:  0.08em;

  /* ---- Spacing (4px base) ---- */
  --sp-1:   4px;
  --sp-2:   8px;
  --sp-3:   12px;
  --sp-4:   16px;
  --sp-5:   20px;
  --sp-6:   24px;
  --sp-8:   32px;
  --sp-10:  40px;
  --sp-12:  48px;
  --sp-16:  64px;
  --sp-20:  80px;

  /* ---- Border Radius ---- */
  --r-none:  0px;
  --r-sm:    4px;
  --r-md:    8px;
  --r-lg:    12px;
  --r-pill:  9999px;

  /* ---- Transitions ---- */
  --ease-micro:   100ms ease-out;
  --ease-fast:    150ms ease-out;
  --ease-default: 200ms ease-in-out;
  --ease-smooth:  300ms cubic-bezier(0.16, 1, 0.3, 1);
  --ease-slow:    400ms cubic-bezier(0.16, 1, 0.3, 1);
  --ease-vanish:  120ms ease-in;  /* instant-out for ad dismissal */

  /* ---- Z-Index ---- */
  --z-base:      0;
  --z-above:     10;
  --z-dropdown:  100;
  --z-sticky:    200;
  --z-overlay:   300;
  --z-modal:     400;
  --z-toast:     500;

  /* ---- Grid ---- */
  --grid-columns: 12;
  --grid-gutter:  16px;
  --grid-max:     1200px;
  --content-max:  680px;

  /* ---- Dot Grid ---- */
  --dot-size:     1px;
  --dot-spacing:  16px;
}


/* ============================================
   LIGHT MODE (Default)
   "Paper" — warm white, dark ink
   ============================================ */

[data-theme="light"],
:root {
  /* Paper (Backgrounds) */
  --bg-primary:       #F7F6F3;
  --bg-secondary:     #EEEDEA;
  --bg-surface:       #FFFFFF;
  --bg-surface-hover: #F2F1EE;
  --bg-inset:         #E8E7E3;
  --bg-elevated:      #FFFFFF;

  /* Ink (Text) */
  --ink-primary:      #0E0E11;
  --ink-secondary:    #5C5C66;
  --ink-tertiary:     #9C9CA5;
  --ink-faint:        #C5C5BF;
  --ink-inverse:      #F7F6F3;

  /* Rules (Borders & Structure) */
  --rule-default:     #DDDDD8;
  --rule-subtle:      #EEEEEA;
  --rule-strong:      #C5C5BF;
  --dot-grid-color:   #D4D4CE;

  /* Emphasis (Active States) */
  --em-primary:       #0E0E11;
  --em-hover:         #2A2A2F;
  --em-surface:       #F0EFEB;
  --em-glow:          rgba(14, 14, 17, 0.06);

  /* Status (Rare — like Nothing's red dot) */
  --status-negative:         #C13438;
  --status-negative-surface: #FCF0F0;
  --status-caution:          #B8860B;
  --status-caution-surface:  #FBF5E6;

  /* Shadows */
  --shadow-sm:    0 1px 2px rgba(14, 14, 17, 0.04);
  --shadow-md:    0 2px 8px rgba(14, 14, 17, 0.06);
  --shadow-lg:    0 8px 24px rgba(14, 14, 17, 0.08);
}


/* ============================================
   DARK MODE
   "Terminal" — near-black, bright ink
   ============================================ */

[data-theme="dark"] {
  /* Terminal (Backgrounds) */
  --bg-primary:       #0A0A0C;
  --bg-secondary:     #111113;
  --bg-surface:       #18181B;
  --bg-surface-hover: #1F1F23;
  --bg-inset:         #0F0F11;
  --bg-elevated:      #222226;

  /* Ink (Text) */
  --ink-primary:      #EDEDF0;
  --ink-secondary:    #8A8A94;
  --ink-tertiary:     #5C5C66;
  --ink-faint:        #3A3A40;
  --ink-inverse:      #0A0A0C;

  /* Rules */
  --rule-default:     #27272B;
  --rule-subtle:      #1E1E22;
  --rule-strong:      #3A3A40;
  --dot-grid-color:   #1E1E22;

  /* Emphasis */
  --em-primary:       #EDEDF0;
  --em-hover:         #D0D0D6;
  --em-surface:       #1F1F23;
  --em-glow:          rgba(237, 237, 240, 0.06);

  /* Status */
  --status-negative:         #E8585C;
  --status-negative-surface: #2A1214;
  --status-caution:          #E0A020;
  --status-caution-surface:  #2A2210;

  /* Shadows */
  --shadow-sm:   0 1px 2px rgba(0, 0, 0, 0.2);
  --shadow-md:   0 2px 8px rgba(0, 0, 0, 0.3);
  --shadow-lg:   0 8px 24px rgba(0, 0, 0, 0.4);
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

.dd-dot-grid-subtle { opacity: 0.25; }
.dd-dot-grid-wide { --dot-spacing: 24px; }
```

---

## Tailwind Config Extension

```js
module.exports = {
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Mono"', 'monospace'],
        body:    ['"DM Sans"', 'system-ui', 'sans-serif'],
        data:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        paper: {
          50:  '#FFFFFF',
          100: '#F7F6F3',
          200: '#EEEDEA',
          300: '#E8E7E3',
          400: '#DDDDD8',
          500: '#C5C5BF',
          600: '#9C9CA5',
          700: '#5C5C66',
          800: '#0E0E11',
        },
        ink: {
          50:  '#EDEDF0',
          100: '#8A8A94',
          200: '#5C5C66',
          300: '#3A3A40',
          400: '#27272B',
          500: '#1F1F23',
          600: '#18181B',
          700: '#111113',
          800: '#0A0A0C',
        },
        negative: { DEFAULT: '#C13438', surface: '#FCF0F0' },
        caution:  { DEFAULT: '#B8860B', surface: '#FBF5E6' },
      },
      borderRadius: {
        'none': '0px', 'sm': '4px', 'md': '8px', 'lg': '12px', 'pill': '9999px',
      },
      fontSize: {
        'hero':    ['48px', { lineHeight: '1.1',  letterSpacing: '-0.03em' }],
        'h1':      ['36px', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'h2':      ['28px', { lineHeight: '1.2',  letterSpacing: '-0.02em' }],
        'h3':      ['22px', { lineHeight: '1.3' }],
        'h4':      ['18px', { lineHeight: '1.35' }],
        'body':    ['16px', { lineHeight: '1.6' }],
        'body-s':  ['14px', { lineHeight: '1.5' }],
        'caption': ['12px', { lineHeight: '1.4' }],
        'data-l':  ['32px', { lineHeight: '1.1' }],
        'data-m':  ['20px', { lineHeight: '1.2' }],
        'data-s':  ['14px', { lineHeight: '1.3' }],
        'data-xs': ['12px', { lineHeight: '1.3' }],
      },
    },
  },
}
```

---

## Google Fonts Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&family=JetBrains+Mono:wght@400;500;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
```

---

## Quick Reference: Font Usage

| Context                    | Font            | Weight  |
|----------------------------|-----------------|---------|
| Page title                 | Space Mono      | 700     |
| Section heading            | Space Mono      | 700     |
| Card title                 | DM Sans         | 600     |
| Body text                  | DM Sans         | 400     |
| UI label / button          | DM Sans         | 500     |
| Dollar amount (large)      | JetBrains Mono  | 700     |
| Dollar amount (inline)     | JetBrains Mono  | 500     |
| Table data                 | JetBrains Mono  | 400     |
| Code / address             | JetBrains Mono  | 400     |
| Category label             | DM Sans         | 600     |
| Tiny data label            | JetBrains Mono  | 500     |

## How Money Is Communicated

Not through color. Through:
1. **JetBrains Mono Bold** — the typeface IS the money signal
2. **Font weight** — 700 for amounts, 400 for context
3. **Tabular figures** — `font-variant-numeric: tabular-nums`
4. **Animation** — the +$0.03 fade-in + glow pulse
5. **Density** — Bloomberg-style tight data layouts
6. **The "$" symbol** — universal, needs no color code
