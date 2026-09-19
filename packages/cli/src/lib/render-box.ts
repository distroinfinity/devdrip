import type { NewsPayload } from "@distrotv/shared"
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

// two-phase "alive" indicator in the header. flips every 500ms to match the
// orchestrator's progress tick cadence, so every re-render visibly moves it.
// ● (solid) → ○ (hollow) → back. in color mode the solid pulses bright green
// and the hollow is dim gray, so it reads as a soft breathing dot. ascii
// fallback uses * / o to stay font-safe.
function liveDot(
  elapsedMs: number,
  ascii: boolean,
  color: ColorMode
): { plain: string; rendered: string } {
  const phase = Math.floor(elapsedMs / 500) % 2
  if (ascii) {
    const ch = phase === 0 ? "*" : "o"
    return { plain: ch, rendered: ch }
  }
  const ch = phase === 0 ? "●" : "○"
  if (color === "none") return { plain: ch, rendered: ch }
  return {
    plain: ch,
    rendered: phase === 0 ? green(ch, color) : dim(ch, color),
  }
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

function clampWidth(w: number | undefined): number {
  const v = w ?? DEFAULT_WIDTH
  if (!Number.isFinite(v)) return DEFAULT_WIDTH
  if (v < MIN_WIDTH) return MIN_WIDTH
  if (v > MAX_WIDTH) return MAX_WIDTH
  return v
}

export interface NewsRenderOpts {
  source?: string
  width?: number
  ascii?: boolean
  color?: ColorMode
  progress?: number // 0..1
  elapsedMs?: number
  // earnings popup intentionally omitted — news doesn't earn.
  // demoBadge intentionally omitted — news has no demo path in mvp.
}

function newsActionFooter(inner: number): string {
  // d = open story  ·  b = save  ·  s = skip  ·  k = kill  ·  m = mute
  const full = "[D] open   [B] save   [S] skip   [K] kill   [M] mute"
  const short = "[D]pen  [B]ave  [S]kip  [K]ill  [M]ute"
  const tiny = "[D] [B] [S] [K] [M]"
  if (inner >= 55) return full
  if (inner >= 34) return short
  return tiny
}

function formatAge(ageSeconds: number): string {
  if (ageSeconds < 60) return "<1m"
  if (ageSeconds < 3600) return `${Math.round(ageSeconds / 60)}m`
  if (ageSeconds < 86400) return `${Math.round(ageSeconds / 3600)}h`
  return `${Math.round(ageSeconds / 86400)}d`
}

export function renderNewsBox(
  payload: Pick<
    NewsPayload,
    "headline" | "url" | "source" | "score" | "ageSeconds" | "commentsUrl"
  >,
  opts: NewsRenderOpts = {}
): string {
  const width = clampWidth(opts.width)
  const inner = width - 4
  const ascii = opts.ascii ?? false
  const c = ascii ? ASCII : UNI
  const color: ColorMode = ascii ? "none" : (opts.color ?? detectColor())

  const title = "DISTRO TV"
  const sourceSegment = opts.source ? `via ${opts.source}` : ""

  const dot = liveDot(opts.elapsedMs ?? 0, ascii, color)
  const tagPlain = ascii ? "NEWS" : "📰 NEWS"
  const tagRendered = ascii ? "NEWS" : "📰 NEWS"

  const leftSegmentsPlain = [title, tagPlain].filter(Boolean)
  const leftSegmentsRendered = [title, tagRendered].filter(Boolean)
  const leftLabelPlain = ` ${dot.plain} ${leftSegmentsPlain.join(" · ")} `
  const leftLabelRendered = ` ${dot.rendered} ${leftSegmentsRendered.join(" · ")} `

  const headerInnerLen = width - 2
  const rightLabelRaw = sourceSegment ? ` ${sourceSegment} ` : ""
  const tentativeFill = headerInnerLen - leftLabelPlain.length - rightLabelRaw.length
  const rightLabel = tentativeFill >= 4 ? rightLabelRaw : ""
  const fillLen = headerInnerLen - leftLabelPlain.length - rightLabel.length
  const left = c.h + leftLabelRendered
  const right = rightLabel + c.h
  const middle = c.h.repeat(Math.max(0, fillLen - 2))
  const header = `${c.tl}${left}${middle}${right}${c.tr}`

  const sourceLabel = ascii ? payload.source : `📰 ${payload.source}`
  const meta = `${sourceLabel} · ${payload.score} pts · ${formatAge(payload.ageSeconds)}`
  const headline = sanitize(payload.headline)
  const url = sanitize(payload.url)

  const footerLine = newsActionFooter(inner)

  const body = [
    line(c, "", inner),
    line(c, sanitize(meta), inner),
    line(c, headline, inner),
    line(c, "", inner),
    line(c, footerLine, inner),
    ...(opts.progress !== undefined
      ? [
          line(c, "", inner),
          line(c, progressLine(opts.progress, opts.elapsedMs ?? 0, inner, ascii, color), inner),
        ]
      : []),
  ]

  const footer = `${c.bl}${c.h.repeat(width - 2)}${c.br}`
  // url is intentionally not appended — news box stays inside the anchored pane.
  // opening the story uses [D] which routes to openUrl in the orchestrator.
  void url
  return [header, ...body, footer].join("\n")
}
