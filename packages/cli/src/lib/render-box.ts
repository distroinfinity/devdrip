import type { AdPayload } from "@devdrip/shared"

const DEFAULT_WIDTH = 72
const MIN_WIDTH = 40
const MAX_WIDTH = 120

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

function padRight(s: string, n: number): string {
  const len = [...s].length
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
  width?: number
  ascii?: boolean
}

function clampWidth(w: number | undefined): number {
  const v = w ?? DEFAULT_WIDTH
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
  const c = (opts.ascii ?? false) ? ASCII : UNI
  const sourceBadge = opts.source ? `via ${opts.source}` : ""
  const title = "DEV DRIP TV"

  // header: c.tl + "═ DEV DRIP TV ═...═ via Carbon ═" + c.tr
  const headerInnerLen = width - 2
  const leftLabel = ` ${title} `
  const rightLabel = sourceBadge ? ` ${sourceBadge} ` : ""
  const fillLen = headerInnerLen - leftLabel.length - rightLabel.length
  const left = c.h + leftLabel
  const right = rightLabel + c.h
  const middle = c.h.repeat(Math.max(0, fillLen - 2))
  const header = `${c.tl}${left}${middle}${right}${c.tr}`

  const headline = sanitize(ad.headline)
  const bodyText = ad.body ? sanitize(ad.body) : ""
  const url = ad.url ? sanitize(ad.url) : ""

  const body = [
    line(c, "", inner),
    line(c, headline, inner),
    ...(bodyText ? wrap(bodyText, inner).map((l) => line(c, l, inner)) : []),
    line(c, "", inner),
    line(
      c,
      padRight("", Math.max(0, Math.floor(inner / 2) - 12)) + "press enter to dismiss",
      inner
    ),
  ]

  const footer = `${c.bl}${c.h.repeat(width - 2)}${c.br}`

  const parts = [header, ...body, footer]
  if (url) parts.push(`→ ${url}`)

  return parts.join("\n")
}
