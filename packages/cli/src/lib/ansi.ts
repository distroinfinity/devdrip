// Minimal ANSI color helpers for terminal-tv surfaces. Token-based palette
// per spec §5. Each token has truecolor + 256-color fallback. New code uses
// `color(token, ...)`; legacy callers (doctor, upgrade, demo) continue to
// import the green/red/yellow shims at the bottom of this file.

export type ColorMode = "truecolor" | "256" | "none"

export function detectColor(env: NodeJS.ProcessEnv = process.env): ColorMode {
  if (env["NO_COLOR"]) return "none"
  if (!process.stdout.isTTY) return "none"
  const colorterm = (env["COLORTERM"] ?? "").toLowerCase()
  if (colorterm === "truecolor" || colorterm === "24bit") return "truecolor"
  const term = (env["TERM"] ?? "").toLowerCase()
  if (term.includes("256color")) return "256"
  if (term === "dumb") return "none"
  return "256"
}

const RESET = "\x1b[0m"

function wrap(body: string, prefix: string): string {
  return `${prefix}${body}${RESET}`
}

interface ColorToken {
  truecolor: string
  fallback256: string
}

// Coinbase dark mode + landing indigo. Tokens chosen per spec §5.
const TOKENS: Record<string, ColorToken> = {
  fg: { truecolor: "\x1b[38;2;255;255;255m", fallback256: "\x1b[38;5;231m" },
  muted: { truecolor: "\x1b[38;2;138;145;158m", fallback256: "\x1b[38;5;247m" },
  rule: { truecolor: "\x1b[38;2;26;28;32m", fallback256: "\x1b[38;5;235m" },
  indigo: { truecolor: "\x1b[38;2;129;140;248m", fallback256: "\x1b[38;5;105m" },
  // Muted indigo — used by the bar-pulse motion at the half-cycle point.
  indigoDim: { truecolor: "\x1b[38;2;80;84;168m", fallback256: "\x1b[38;5;61m" },
  positive: { truecolor: "\x1b[38;2;39;173;117m", fallback256: "\x1b[38;5;72m" },
  negative: { truecolor: "\x1b[38;2;240;97;109m", fallback256: "\x1b[38;5;167m" },
  warning: { truecolor: "\x1b[38;2;248;150;86m", fallback256: "\x1b[38;5;215m" },
}

export type TokenName = keyof typeof TOKENS

export function color(token: TokenName, text: string, mode: ColorMode): string {
  if (mode === "none") return text
  const t = TOKENS[token]
  if (!t) return text
  return wrap(text, mode === "truecolor" ? t.truecolor : t.fallback256)
}

// Custom-RGB foreground for brand chips (brand-colors.ts table).
export function rgb(text: string, r: number, g: number, b: number, mode: ColorMode): string {
  if (mode === "none") return text
  if (mode === "truecolor") return wrap(text, `\x1b[38;2;${r};${g};${b}m`)
  const idx = nearest256(r, g, b)
  return wrap(text, `\x1b[38;5;${idx}m`)
}

// Custom-RGB background for brand chips.
export function bgRgb(text: string, r: number, g: number, b: number, mode: ColorMode): string {
  if (mode === "none") return text
  if (mode === "truecolor") return wrap(text, `\x1b[48;2;${r};${g};${b}m`)
  const idx = nearest256(r, g, b)
  return wrap(text, `\x1b[48;5;${idx}m`)
}

function nearest256(r: number, g: number, b: number): number {
  // xterm-256 6×6×6 color cube starts at index 16. Each channel uses the
  // canonical levels [0, 95, 135, 175, 215, 255].
  const levels = [0, 95, 135, 175, 215, 255]
  const nearest = (v: number): number => {
    let best = 0
    let bestD = Infinity
    for (let i = 0; i < levels.length; i++) {
      const d = Math.abs(v - (levels[i] as number))
      if (d < bestD) {
        bestD = d
        best = i
      }
    }
    return best
  }
  return 16 + 36 * nearest(r) + 6 * nearest(g) + nearest(b)
}

export function dim(text: string, mode: ColorMode): string {
  if (mode === "none") return text
  return wrap(text, "\x1b[2m")
}

export function bold(text: string, mode: ColorMode): string {
  if (mode === "none") return text
  return wrap(text, "\x1b[1m")
}

// Legacy shims — map old `green`/`red`/`yellow` callsites to the new
// semantic tokens. New code should call `color(...)` directly.
export function green(text: string, mode: ColorMode): string {
  return color("positive", text, mode)
}
export function red(text: string, mode: ColorMode): string {
  return color("negative", text, mode)
}
export function yellow(text: string, mode: ColorMode): string {
  return color("warning", text, mode)
}
