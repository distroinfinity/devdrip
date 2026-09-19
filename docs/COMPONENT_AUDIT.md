# P0-002.5: Component Audit — Decision Matrix

Audited all MagicUI, Aceternity, and shadcn components planned for the landing page.
Every USE component is restyled to the Industrial Paper design token system, passes the
desaturation test, and has basic accessibility attributes.

## Bundle Budget

| Route                 | First Load JS | Status                  |
| --------------------- | ------------- | ----------------------- |
| Landing page (`/`)    | 141 KB        | within budget           |
| Audit page (`/audit`) | 164 KB        | all components loaded   |
| Shared JS             | 87.3 KB       | framer-motion dominates |

## Decision Matrix

### Existing Components (already installed)

| Component          | Source     | Decision             | Section(s)   | Changes Made                                                       |
| ------------------ | ---------- | -------------------- | ------------ | ------------------------------------------------------------------ |
| BlurFade           | MagicUI    | **USE**              | all sections | none — clean                                                       |
| DotPattern         | MagicUI    | **USE** (sparingly)  | SVG-specific | none — uses `var(--dot-grid-color)`                                |
| NumberTicker       | MagicUI    | **USE**              | P0-008       | `text-black` → `var(--ink-primary)`, added `aria-label`            |
| ScrollProgress     | MagicUI    | **USE**              | P0-014       | gradient → `var(--ink-primary)`, added `aria-hidden`               |
| Terminal           | MagicUI    | **USE**              | P0-003/004   | keep traffic lights (semantic macOS convention)                    |
| TypingAnimation    | MagicUI    | **USE**              | P0-003/004   | added `aria-label`                                                 |
| EncryptedText      | Aceternity | **USE**              | P0-003 hero  | none — clean, has `aria-label` + `role="text"`                     |
| StickyScrollReveal | Aceternity | **USE** (iOS caveat) | P0-005       | removed hardcoded bg arrays + all slate/neutral refs → tokens      |
| Tabs               | Aceternity | **USE**              | P0-006       | `bg-gray-200` → `var(--bg-inset)`, added ARIA roles                |
| Timeline           | Aceternity | **USE**              | P0-005/011   | all neutral/purple refs → tokens, gradient → `var(--accent-color)` |
| TypewriterEffect   | Aceternity | **REMOVED**          | —            | redundant with TypingAnimation + EncryptedText                     |

### New Components (installed this task)

| Component               | Source     | Decision         | Section(s)    | Changes Made                                                           |
| ----------------------- | ---------- | ---------------- | ------------- | ---------------------------------------------------------------------- |
| AnimatedBeam            | MagicUI    | **USE**          | P0-009/010    | defaults → `var(--ink-faint)`, `var(--accent-color)`                   |
| FileTree                | MagicUI    | **USE**          | P0-010        | TreeIndicator `hover:bg-slate-300` → `var(--rule-strong)`              |
| FloatingNavbar          | Aceternity | **USE**          | P0-013        | full restyle to tokens, removed `@tabler/icons`, added `ctaLabel` prop |
| PlaceholdersVanishInput | Aceternity | **USE**          | waitlist      | full restyle to tokens                                                 |
| CodeBlock               | Custom     | **BUILD CUSTOM** | P0-006        | replaced Aceternity version (react-syntax-highlighter = 262KB)         |
| Accordion               | shadcn     | **USE**          | P0-012 FAQ    | none — uses shadcn CSS variables                                       |
| Button                  | shadcn     | **USE**          | multiple      | none — uses shadcn CSS variables                                       |
| ScrollArea              | shadcn     | **USE**          | with FileTree | none — uses shadcn CSS variables                                       |
| WaitlistButton          | Custom     | **BUILD CUSTOM** | waitlist      | 3-state (idle/submitting/success), uses delta keyframes                |

### Evaluated & Skipped

| Component                | Source     | Decision | Reason                                                                        |
| ------------------------ | ---------- | -------- | ----------------------------------------------------------------------------- |
| HyperText                | MagicUI    | **SKIP** | forces uppercase, no aria-label, heavier AnimatePresence. EncryptedText wins. |
| ShimmerButton            | MagicUI    | **SKIP** | monochrome shimmer looks like rendering glitch                                |
| AnimatedCircularProgress | MagicUI    | **SKIP** | linear ProgressBar more on-brand for data-density aesthetic                   |
| FlickeringGrid           | MagicUI    | **SKIP** | canvas-based, heavier than CSS DotGrid, squares deviate from spec             |
| TracingBeam              | Aceternity | **SKIP** | landing page isn't long-form prose                                            |
| WorldMap                 | Aceternity | **SKIP** | 80-150KB SVG, blueprint says "no illustrations, just the math"                |
| ExpandableCard           | Aceternity | **SKIP** | overkill for FAQ, shadcn Accordion lighter and a11y-compliant                 |
| NoiseBackground          | Aceternity | **SKIP** | canvas gradient conflicts with monochrome, DotGrid is primary texture         |
| ASCIIArt                 | Aceternity | **SKIP** | CPU-intensive on mount, hurts LCP                                             |
| DitherShader             | Aceternity | **SKIP** | cannot verify exists, likely requires WebGL                                   |
| StatefulButton           | Aceternity | **SKIP** | not a real component, built custom WaitlistButton instead                     |

## Gotchas for Next Tasks

- **StickyScrollReveal** — known to be janky on iOS Safari with `position: sticky` inside overflow containers. Test on real device before committing for P0-005. Fallback: simple `useScroll` + `useTransform` approach.
- **CodeBlock** — custom build has no syntax highlighting. For the Surfaces section VS Code mockup, consider adding minimal keyword coloring via regex if needed.
- **Tabs** — the Aceternity card-stack animation doesn't behave like semantic tabs. ARIA roles added but keyboard arrow navigation not implemented. Consider Radix Tabs if full a11y compliance needed.
- **FloatingNavbar** z-index is `var(--z-sticky)` (200). ScrollProgress is `z-50`. No conflict at current values but verify if adding more fixed elements.
- **shadcn installer** mangled `tailwind.config.ts` — broke font family quotes and added `"class"` to `darkMode`. Fixed manually. Watch for this on future shadcn installs.

## New Dependencies Added

| Package                       | Purpose                   | Size Impact  |
| ----------------------------- | ------------------------- | ------------ |
| `@radix-ui/react-accordion`   | FileTree + Accordion      | ~3KB gzipped |
| `@radix-ui/react-scroll-area` | ScrollArea (for FileTree) | ~2KB gzipped |
| `@radix-ui/react-slot`        | Button component          | ~1KB gzipped |

## Dependencies Removed

| Package                           | Reason                                              |
| --------------------------------- | --------------------------------------------------- |
| `react-syntax-highlighter`        | 262KB bundle impact, replaced with custom CodeBlock |
| `@types/react-syntax-highlighter` | no longer needed                                    |
| `@tabler/icons-react`             | replaced with lucide-react (already installed)      |

## Files Modified

- `components/ui/number-ticker.tsx` — color fix + aria-label
- `components/ui/scroll-progress.tsx` — gradient fix + aria-hidden
- `components/ui/tabs.tsx` — color fix + ARIA roles
- `components/ui/timeline.tsx` — full restyle (8 locations)
- `components/ui/sticky-scroll-reveal.tsx` — full restyle (removed bg arrays)
- `components/ui/typing-animation.tsx` — aria-label
- `components/ui/animated-beam.tsx` — default colors → tokens
- `components/ui/file-tree.tsx` — TreeIndicator color fix
- `components/ui/floating-navbar.tsx` — full restyle + lucide icons
- `components/ui/placeholders-and-vanish-input.tsx` — full restyle
- `components/ui/code-block.tsx` — rebuilt from scratch (no react-syntax-highlighter)
- `tailwind.config.ts` — fixed broken font quotes + darkMode config

## Files Created

- `components/shared/waitlist-button.tsx` — custom 3-state button
- `components/ui/accordion.tsx` — shadcn accordion
- `components/ui/button.tsx` — shadcn button
- `components/ui/scroll-area.tsx` — shadcn scroll area
- `docs/COMPONENT_AUDIT.md` — this file

## Files Removed

- `components/ui/typewriter-effect.tsx` — redundant
- `components/ui/hyper-text.tsx` — lost comparison to EncryptedText
