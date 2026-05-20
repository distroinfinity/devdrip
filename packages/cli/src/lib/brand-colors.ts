import type { ColorMode } from "./ansi.js"
import { bgRgb, rgb } from "./ansi.js"

interface ChipColor {
  bg: [number, number, number]
  fg: [number, number, number]
}

// Curated brand colors per spec §6. Keys match against the uppercased ticker
// (for markets) or source identifier (for news). Unknown keys fall back to a
// neutral dark chip — never breaks layout.
const BRANDS: Record<string, ChipColor> = {
  // ── equities ──
  TSLA: { bg: [204, 0, 0], fg: [255, 255, 255] },
  AAPL: { bg: [42, 42, 44], fg: [255, 255, 255] },
  NVDA: { bg: [118, 185, 0], fg: [0, 0, 0] },
  AMZN: { bg: [255, 153, 0], fg: [0, 0, 0] },
  MSFT: { bg: [0, 164, 239], fg: [255, 255, 255] },
  GOOGL: { bg: [66, 133, 244], fg: [255, 255, 255] },
  GOOG: { bg: [66, 133, 244], fg: [255, 255, 255] },
  META: { bg: [24, 119, 242], fg: [255, 255, 255] },
  NFLX: { bg: [229, 9, 20], fg: [255, 255, 255] },
  SPOT: { bg: [30, 215, 96], fg: [0, 0, 0] },
  UBER: { bg: [9, 9, 26], fg: [255, 255, 255] },
  ABNB: { bg: [255, 90, 95], fg: [255, 255, 255] },
  COIN: { bg: [0, 82, 255], fg: [255, 255, 255] },
  HOOD: { bg: [0, 200, 5], fg: [0, 0, 0] },
  PLTR: { bg: [0, 0, 0], fg: [255, 255, 255] },
  AMD: { bg: [237, 28, 36], fg: [255, 255, 255] },
  INTC: { bg: [0, 113, 197], fg: [255, 255, 255] },
  CRM: { bg: [0, 161, 224], fg: [255, 255, 255] },
  ORCL: { bg: [241, 0, 0], fg: [255, 255, 255] },
  SHOP: { bg: [149, 191, 70], fg: [0, 0, 0] },
  DIS: { bg: [17, 60, 207], fg: [255, 255, 255] },
  WMT: { bg: [0, 113, 206], fg: [255, 255, 255] },
  // ── crypto ──
  BTC: { bg: [247, 147, 26], fg: [0, 0, 0] },
  ETH: { bg: [98, 126, 234], fg: [255, 255, 255] },
  SOL: { bg: [20, 241, 149], fg: [0, 0, 0] },
  DOGE: { bg: [194, 166, 73], fg: [255, 255, 255] },
  USDC: { bg: [39, 117, 202], fg: [255, 255, 255] },
  XRP: { bg: [0, 0, 0], fg: [255, 255, 255] },
  ADA: { bg: [0, 51, 173], fg: [255, 255, 255] },
  AVAX: { bg: [232, 65, 66], fg: [255, 255, 255] },
  MATIC: { bg: [130, 71, 229], fg: [255, 255, 255] },
  LINK: { bg: [42, 91, 222], fg: [255, 255, 255] },
  // ── news sources (short codes) ──
  HN: { bg: [255, 102, 0], fg: [255, 255, 255] },
  TC: { bg: [0, 210, 122], fg: [0, 0, 0] },
  BBG: { bg: [255, 111, 0], fg: [0, 0, 0] },
  RTR: { bg: [255, 128, 0], fg: [255, 255, 255] },
  ARS: { bg: [255, 79, 0], fg: [255, 255, 255] },
  VRG: { bg: [255, 51, 102], fg: [255, 255, 255] },
  WIRED: { bg: [0, 0, 0], fg: [255, 255, 255] },
  WSJ: { bg: [0, 0, 0], fg: [255, 255, 255] },
  NYT: { bg: [0, 0, 0], fg: [255, 255, 255] },
  FT: { bg: [252, 213, 184], fg: [0, 0, 0] },
  ECON: { bg: [225, 24, 26], fg: [255, 255, 255] },
  GIT: { bg: [36, 41, 47], fg: [255, 255, 255] },
  PROD: { bg: [218, 85, 47], fg: [255, 255, 255] },
  // ── source aliases (full names) ──
  HACKERNEWS: { bg: [255, 102, 0], fg: [255, 255, 255] },
  TECHCRUNCH: { bg: [0, 210, 122], fg: [0, 0, 0] },
  BLOOMBERG: { bg: [255, 111, 0], fg: [0, 0, 0] },
  REUTERS: { bg: [255, 128, 0], fg: [255, 255, 255] },
}

const FALLBACK: ChipColor = { bg: [42, 42, 44], fg: [255, 255, 255] }

export function getChipColor(key: string): ChipColor {
  const upper = key.toUpperCase().replace(/[^A-Z0-9]/g, "")
  return BRANDS[upper] ?? FALLBACK
}

// Resolves a NewsSource enum value (or any source identifier) to a short
// display code used as the chip label. "hackernews" → "HN", etc.
const SOURCE_DISPLAY_CODES: Record<string, string> = {
  HACKERNEWS: "HN",
  TECHCRUNCH: "TC",
  BLOOMBERG: "BBG",
  REUTERS: "RTR",
  ARSTECHNICA: "ARS",
  THEVERGE: "VRG",
}

export function chipLabelFor(source: string): string {
  const upper = source.toUpperCase().replace(/[^A-Z0-9]/g, "")
  return SOURCE_DISPLAY_CODES[upper] ?? upper.slice(0, 5)
}

// Renders a colored chip: " TSLA " with bg + fg ANSI applied.
// The label is rendered with 1-char padding so it reads as a chip block.
export function renderChip(label: string, mode: ColorMode): string {
  const { bg, fg } = getChipColor(label)
  const padded = ` ${label} `
  return bgRgb(rgb(padded, fg[0], fg[1], fg[2], mode), bg[0], bg[1], bg[2], mode)
}

// Returns the visible width of a chip rendering. Always label.length + 2
// (one space pad each side). ANSI escapes are zero-width.
export function chipVisibleWidth(label: string): number {
  return label.length + 2
}
