// minimal ANSI color helpers for terminal-tv surfaces. kept tiny on purpose:
// the renderer already writes raw escape sequences, and we don't want another
// styling library on the hot path (every 500ms progress tick re-renders).

export type ColorMode = "truecolor" | "256" | "none"

export function detectColor(env: NodeJS.ProcessEnv = process.env): ColorMode {
  if (env["NO_COLOR"]) return "none"
  if (!process.stdout.isTTY) return "none"
  const colorterm = (env["COLORTERM"] ?? "").toLowerCase()
  if (colorterm === "truecolor" || colorterm === "24bit") return "truecolor"
  const term = (env["TERM"] ?? "").toLowerCase()
  if (term.includes("256color")) return "256"
  if (term === "dumb") return "none"
  // most modern terminals (iTerm2, kitty, wezterm, Alacritty, macOS Terminal)
  // default to xterm or xterm-256color without setting COLORTERM. assume 256
  // is safe rather than dropping to no-color.
  return "256"
}

const RESET = "\x1b[0m"

function wrap(body: string, prefix: string): string {
  return `${prefix}${body}${RESET}`
}

// accent green — used sparingly. truecolor value chosen to match the landing
// page's earnings-counter color (#2EA043, GitHub-style success green) so the
// CLI and web surfaces feel related without forcing a full palette on the
// terminal. 256-color fallback is xterm 34 (a deep green).
export function green(text: string, mode: ColorMode): string {
  if (mode === "none") return text
  if (mode === "truecolor") return wrap(text, "\x1b[38;2;46;160;67m")
  return wrap(text, "\x1b[38;5;34m")
}

export function dim(text: string, mode: ColorMode): string {
  if (mode === "none") return text
  return wrap(text, "\x1b[2m")
}

export function bold(text: string, mode: ColorMode): string {
  if (mode === "none") return text
  return wrap(text, "\x1b[1m")
}
