import type { AdPayload } from "@devdrip/shared"
import { detectColor, dim, green, type ColorMode } from "./ansi.js"

const DEFAULT_WIDTH = 72
const MIN_WIDTH = 40
const MAX_WIDTH = 120

// ticker verbs cycle on the progress line while Claude is working. the swap
// cadence is ~4s so the motion reads as deliberate rather than busy. intended
// to blend with Claude Code's own "verb + ellipsis" idle feel without copying
// specific words. ASCII fallback always uses "working" (no unicode ellipsis).
const VERBS = ["working", "thinking", "shipping", "cooking"] as const
const VERB_SWAP_MS = 4_000

interface Chars {
  tl: string
  tr: string
  bl: string
  br: string
  h: string
  v: string
}

const UNI: Chars = { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" }
const ASCII: Chars = { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" }
const ANSI_ESCAPE_RE = /\u001b(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g

export function shouldUseAscii(): boolean {
  if (process.env["NO_COLOR"]) return true
  if (!process.stdout.isTTY) return true
  return false
}

function actionFooter(inner: number): string {
  // full label works at inner >= 55; shorter at narrow widths.
  const full = "[D] discover   [S] skip   [K] kill session   [M] mute 30m"
  const short = "[D]iscover  [S]kip  [K]ill  [M]ute"
  const tiny = "[D] [S] [K] [M]"
  if (inner >= 55) return full
  if (inner >= 34) return short
  return tiny
}

function progressBar(progress: number, cells: number, ascii: boolean, color: ColorMode): string {
  const clamped = progress < 0 ? 0 : progress > 1 ? 1 : progress
  // filled count is cells-1 so there's always room for the head cell; when
  // progress crosses into the last cell we render a full track with no head.
  const filledBody = Math.floor(clamped * (cells - 1))
  const atEnd = filledBody >= cells - 1
  // thin-track unicode reads as "polished CLI" (Vercel/Railway style) inside
  // the existing heavy double border. ascii fallback stays equals-signs.
  const fillCh = ascii ? "=" : "━"
  const headCh = ascii ? ">" : "╸"
  const emptyCh = ascii ? "-" : "─"
  const filledStr = fillCh.repeat(atEnd ? cells : filledBody)
  const head = atEnd ? "" : headCh
  const rest = emptyCh.repeat(Math.max(0, cells - filledBody - 1))
  // accent only the filled portion so the "done so far" reads at a glance.
  // leave the track dim gray (or default) so it doesn't scream.
  return `${green(filledStr, color)}${green(head, color)}${dim(rest, color)}`
}

// 4-slot verb rotation keyed off elapsed ms. deterministic so repeated renders
// for the same progress tick pick the same verb (no flicker when `updateProgress`
// is called back-to-back within the same 4s window).
function pickVerb(elapsedMs: number, ascii: boolean): string {
  if (ascii) return "working"
  const idx = Math.floor(elapsedMs / VERB_SWAP_MS) % VERBS.length
  return VERBS[idx] ?? VERBS[0]
}

function progressLine(
  progress: number,
  elapsedMs: number,
  inner: number,
  ascii: boolean,
  color: ColorMode
): string {
  const verb = pickVerb(elapsedMs, ascii)
  const pct = `${Math.min(100, Math.round(progress * 100))}%`
  // reserve space for verb, two spaces around bar, pct. cells = whatever is
  // left, clamped 8..30 so narrow terminals don't get ugly. narrower than the
  // old 40% heuristic — the bar is now visually lighter so it doesn't need
  // the width to feel substantial.
  const fixedCost = verb.length + 1 + 1 + pct.length + 1
  const raw = inner - fixedCost
  const cells = Math.max(8, Math.min(30, raw))
  const bar = progressBar(progress, cells, ascii, color)
  return `${dim(verb, color)} ${bar} ${dim(pct, color)}`
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    // long tokens (URLs, etc.) — truncate to keep box width
    if ([...w].length > max) {
      if (cur) {
        lines.push(cur)
        cur = ""
      }
      lines.push([...w].slice(0, max - 1).join("") + "…")
      continue
    }
    if (cur.length === 0) {
      cur = w
      continue
    }
    if ([...cur].length + 1 + [...w].length <= max) {
      cur += ` ${w}`
    } else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur.length > 0) lines.push(cur)
  return lines
}

function visibleLen(s: string): number {
  // exclude ANSI SGR escapes from width calc so the right-hand box border
  // aligns even when the line contains color codes (progress bar).
  return [...s.replace(ANSI_ESCAPE_RE, "")].length
}

function padRight(s: string, n: number): string {
  const len = visibleLen(s)
  if (len >= n) return s
  return s + " ".repeat(n - len)
}

function line(c: Chars, text: string, inner: number): string {
  return `${c.v} ${padRight(text, inner)} ${c.v}`
}

function sanitize(text: string): string {
  // Strip terminal control sequences and remaining control bytes from ad copy.
  return text.replace(ANSI_ESCAPE_RE, "").replace(/[\x00-\x1F\x7F]/g, "")
}

export interface RenderBoxOpts {
  source?: string
  earningsUsdc?: number
  progress?: number // 0..1
  // elapsed ms since the ad was first shown — drives the verb rotation on the
  // progress line. optional: falls back to 0 (always shows the first verb) so
  // static callers/tests don't need to thread timing through.
  elapsedMs?: number
  width?: number
  ascii?: boolean
  // color hint override for tests; detected from env by default.
  color?: ColorMode
}

function clampWidth(w: number | undefined): number {
  const v = w ?? DEFAULT_WIDTH
  if (!Number.isFinite(v)) return DEFAULT_WIDTH
  if (v < MIN_WIDTH) return MIN_WIDTH
  if (v > MAX_WIDTH) return MAX_WIDTH
  return v
}

export function renderBox(
  ad: Pick<AdPayload, "headline" | "body" | "url">,
  opts: RenderBoxOpts = {}
): string {
  const width = clampWidth(opts.width)
  const inner = width - 4 // space for "║ " and " ║"
  const ascii = opts.ascii ?? false
  const c = ascii ? ASCII : UNI
  // no color when ASCII fallback is on — NO_COLOR/non-TTY imply monochrome.
  const color: ColorMode = ascii ? "none" : (opts.color ?? detectColor())
  const title = "DEV DRIP TV"
  const earningsSegment =
    opts.earningsUsdc !== undefined ? `$${opts.earningsUsdc.toFixed(4)} earned` : ""
  const sourceSegment = opts.source ? `via ${opts.source}` : ""

  // build header segments separated by " · " when multiple exist
  const leftSegments = [title, earningsSegment].filter(Boolean)
  const leftLabel = ` ${leftSegments.join(" · ")} `
  // drop the right segment if it would push the header past `width`. need at
  // least 4 fill chars (2 left corner pad + 2 right corner pad) for the box
  // to render cleanly; below that, the right label is dropped entirely so
  // the header still aligns at exactly `width`.
  const headerInnerLen = width - 2
  const rightLabelRaw = sourceSegment ? ` ${sourceSegment} ` : ""
  const tentativeFill = headerInnerLen - leftLabel.length - rightLabelRaw.length
  const rightLabel = tentativeFill >= 4 ? rightLabelRaw : ""
  const fillLen = headerInnerLen - leftLabel.length - rightLabel.length
  const left = c.h + leftLabel
  const right = rightLabel + c.h
  const middle = c.h.repeat(Math.max(0, fillLen - 2))
  const header = `${c.tl}${left}${middle}${right}${c.tr}`

  const headline = sanitize(ad.headline)
  const bodyText = ad.body ? sanitize(ad.body) : ""
  const url = ad.url ? sanitize(ad.url) : ""

  const footerLine = actionFooter(inner)

  const body = [
    line(c, "", inner),
    line(c, headline, inner),
    ...(bodyText ? wrap(bodyText, inner).map((l) => line(c, l, inner)) : []),
    line(c, "", inner),
    line(c, footerLine, inner),
    ...(opts.progress !== undefined
      ? [line(c, progressLine(opts.progress, opts.elapsedMs ?? 0, inner, ascii, color), inner)]
      : []),
  ]

  const footer = `${c.bl}${c.h.repeat(width - 2)}${c.br}`

  const parts = [header, ...body, footer]
  if (url) parts.push(`→ ${url}`)

  return parts.join("\n")
}
