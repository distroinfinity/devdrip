import type { NewsPayload } from "@distrotv/shared"
import { detectColor, color, type ColorMode } from "./ansi.js"
import { chipLabelFor, renderChip } from "./brand-colors.js"

const DEFAULT_WIDTH = 80
const MIN_WIDTH = 40
const MAX_WIDTH = 120

const ANSI_ESCAPE_RE = /\x1b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g

function sanitize(text: string): string {
  return text.replace(ANSI_ESCAPE_RE, "").replace(/[\x00-\x1F\x7F]/g, "")
}

function clampWidth(w: number | undefined): number {
  const v = w ?? DEFAULT_WIDTH
  if (!Number.isFinite(v)) return DEFAULT_WIDTH
  if (v < MIN_WIDTH) return MIN_WIDTH
  if (v > MAX_WIDTH) return MAX_WIDTH
  return v
}

function formatAgeLong(ageSeconds: number): string {
  if (ageSeconds < 60) return "just now"
  if (ageSeconds < 3600) return `${Math.round(ageSeconds / 60)}m ago`
  if (ageSeconds < 86400) return `${Math.round(ageSeconds / 3600)}h ago`
  return `${Math.round(ageSeconds / 86400)}d ago`
}

function formatAgeShort(ageSeconds: number): string {
  if (ageSeconds < 60) return "<1m"
  if (ageSeconds < 3600) return `${Math.round(ageSeconds / 60)}m`
  if (ageSeconds < 86400) return `${Math.round(ageSeconds / 3600)}h`
  return `${Math.round(ageSeconds / 86400)}d`
}

// Word-wrap a string into at most `maxLines` lines of width `w`. If the text
// doesn't fit, the last line is truncated with a single trailing ellipsis.
function wrapHeadline(text: string, w: number, maxLines: number): string[] {
  const clean = sanitize(text)
  const words = clean.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  let consumed = 0

  for (const word of words) {
    if (current.length === 0) {
      current = word
      consumed++
      continue
    }
    if (current.length + 1 + word.length <= w) {
      current += " " + word
      consumed++
    } else {
      lines.push(current)
      if (lines.length >= maxLines) {
        current = ""
        break
      }
      current = word
      consumed++
    }
  }
  if (current.length > 0 && lines.length < maxLines) lines.push(current)

  // If we ran out of lines before consuming all words, ellipsize the last line.
  if (consumed < words.length && lines.length > 0) {
    const last = lines[lines.length - 1] as string
    const trimmed = last.length >= w ? last.slice(0, w - 1) : last
    lines[lines.length - 1] = trimmed + "…"
  }
  return lines
}

function newsFooter(innerWidth: number): string {
  const full = "[D] open · [B] save · [S] skip · [K] kill"
  const short = "[D] · [B] · [S] · [K]"
  return innerWidth >= full.length ? full : short
}

export interface NewsRenderOpts {
  width?: number
  color?: ColorMode
  // When set, overrides the right-aligned header text with a flash message
  // (e.g., "✓ saved"). Used by the daemon's flashHeader motion.
  flash?: { text: string; token: "positive" | "negative" | "muted" | "warning" }
  // Legacy fields ignored by the new renderer; kept for caller compat with
  // daemon/display.ts until that file is updated in later tasks.
  source?: string
  progress?: number
  elapsedMs?: number
  ascii?: boolean
}

export function renderNewsBox(
  payload: Pick<NewsPayload, "headline" | "url" | "source" | "score" | "ageSeconds">,
  opts: NewsRenderOpts = {}
): string {
  const width = clampWidth(opts.width)
  const mode: ColorMode = opts.color ?? detectColor()

  // Tier selection per spec §10.
  const showLive = width >= 60
  const showSourceName = width >= 80
  const showScore = width >= 60
  const useShortAge = width < 60

  // ── header ──────────────────────────────────────────────
  // ▍ news · live                                     2h ago
  const ageText = useShortAge
    ? formatAgeShort(payload.ageSeconds)
    : formatAgeLong(payload.ageSeconds)
  const liveSuffix = showLive ? ` ${color("muted", "·", mode)} ${color("muted", "live", mode)}` : ""
  const leftPlain = showLive ? `▍ news · live` : `▍ news`
  const left = `${color("indigo", "▍", mode)} ${color("indigo", "news", mode)}${liveSuffix}`

  const rightPlain = opts.flash ? opts.flash.text + "   " + ageText : ageText
  const right = opts.flash
    ? `${color(opts.flash.token, opts.flash.text, mode)}   ${color("muted", ageText, mode)}`
    : color("muted", ageText, mode)

  const headerPad = Math.max(1, width - leftPlain.length - rightPlain.length)
  const header = left + " ".repeat(headerPad) + right

  // ── rules ───────────────────────────────────────────────
  const rule = color("rule", "─".repeat(width), mode)

  // ── meta row ────────────────────────────────────────────
  //   [HN]  Hacker News  ·  ↑ 418
  const chipLabel = chipLabelFor(payload.source)
  const chipRendered = renderChip(chipLabel, mode)

  const scorePart = payload.score != null ? `↑ ${payload.score}` : ""
  let metaTail = ""
  let metaTailRendered = ""

  if (showSourceName) {
    metaTail += `  ${payload.source}`
    metaTailRendered += `  ${color("muted", payload.source, mode)}`
    if (scorePart && showScore) {
      metaTail += `  ·  ${scorePart}`
      metaTailRendered += `  ${color("muted", "·", mode)}  ${color("muted", scorePart, mode)}`
    }
  } else if (scorePart && showScore) {
    metaTail += `  ${scorePart}`
    metaTailRendered += `  ${color("muted", scorePart, mode)}`
  }
  void metaTail // plain version retained for future width-budget logic; suppress unused warning
  const metaLine = `  ${chipRendered}${metaTailRendered}`

  // ── headline ────────────────────────────────────────────
  const headlineW = width - 4 // 2-space indent left + small right safety
  const headlineLines = wrapHeadline(payload.headline, headlineW, 2)
  const headlineRendered = headlineLines.map((l) => "  " + color("fg", l, mode))

  // ── footer ──────────────────────────────────────────────
  const footerInner = width - 4
  const footerLine = "  " + color("muted", newsFooter(footerInner), mode)

  return [header, rule, "", metaLine, "", ...headlineRendered, "", rule, footerLine].join("\n")
}
