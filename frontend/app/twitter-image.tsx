import { cardThemes, renderCard } from "@/lib/og/render"

export const runtime = "edge"
export const alt = "Distro TV — the ad exchange for AI agent surfaces."
export const size = { width: 1200, height: 675 }
export const contentType = "image/png"

export default function TwitterImage() {
  return renderCard(cardThemes.dark, size)
}
