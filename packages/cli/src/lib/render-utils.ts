// shared layout helpers for the status-line panels.

const ANSI_RE = /\x1b\[[0-9;]*m/g
export const LEFT_PAD = "  "

export function visLen(s: string): number {
  return [...s.replace(ANSI_RE, "")].length
}

// left … right, right-justified to `width` (min 3-space gap so they never touch)
export function spread(left: string, right: string, width: number): string {
  const gap = Math.max(3, width - visLen(left) - visLen(right))
  return left + " ".repeat(gap) + right
}

// Word-wrap into up to `maxLines`, ellipsizing the last line if it overflows.
export function wrapHeadline(text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ""
  let consumed = 0
  for (const word of words) {
    if (current.length === 0) {
      current = word
      consumed++
      continue
    }
    if (current.length + 1 + word.length <= width) {
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
  if (consumed < words.length && lines.length > 0) {
    const last = lines[lines.length - 1] as string
    const trimmed = last.length >= width ? last.slice(0, width - 1) : last
    lines[lines.length - 1] = trimmed + "…"
  }
  return lines
}
