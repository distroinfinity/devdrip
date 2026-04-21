import type { AdPayload } from "@devdrip/shared"

const WIDTH = 72
const INNER = WIDTH - 4 // space for "║ " and " ║"

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
    if (cur.length === 0) {
      cur = w
      continue
    }
    if (cur.length + 1 + w.length <= max) {
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

function line(c: Chars, inner: string): string {
  return `${c.v} ${padRight(inner, INNER)} ${c.v}`
}

export interface RenderBoxOpts {
  source?: string
  earningsUsdc?: number
  ascii?: boolean
}

export function renderBox(
  ad: Pick<AdPayload, "headline" | "body" | "url">,
  opts: RenderBoxOpts = {}
): string {
  const c = (opts.ascii ?? false) ? ASCII : UNI
  const sourceBadge = opts.source ? `via ${opts.source}` : ""
  const title = "DEV DRIP TV"

  // header: c.tl + "═ DEV DRIP TV ═...═ via Carbon ═" + c.tr
  const headerInnerLen = WIDTH - 2
  const leftLabel = ` ${title} `
  const rightLabel = sourceBadge ? ` ${sourceBadge} ` : ""
  const fillLen = headerInnerLen - leftLabel.length - rightLabel.length
  const left = c.h + leftLabel
  const right = rightLabel + c.h
  const middle = c.h.repeat(Math.max(0, fillLen - 2))
  const header = `${c.tl}${left}${middle}${right}${c.tr}`

  const body = [
    line(c, ""),
    line(c, ad.headline),
    ...(ad.body ? wrap(ad.body, INNER).map((l) => line(c, l)) : []),
    line(c, ""),
    ...(ad.url ? [line(c, `Learn more → ${ad.url}`)] : []),
    line(c, ""),
    line(c, padRight("", Math.max(0, Math.floor(INNER / 2) - 12)) + "press enter to dismiss"),
  ]

  const footer = `${c.bl}${c.h.repeat(WIDTH - 2)}${c.br}`

  return [header, ...body, footer].join("\n")
}
