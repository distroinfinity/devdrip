import { cardThemes, renderCard } from "@/lib/og/render"

export const runtime = "edge"
export const alt = "Distro TV — channels for the moments your agent runs the keyboard."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function OgImage() {
  return renderCard(cardThemes.light, size)
}
