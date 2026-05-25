import { cardThemes, renderCard } from "@/lib/og/render"

export const runtime = "edge"
export const alt = "Distro TV — channels for the moments your agent runs the keyboard."
export const size = { width: 1200, height: 675 }
export const contentType = "image/png"

export default function TwitterImage() {
  return renderCard(cardThemes.dark, size)
}
