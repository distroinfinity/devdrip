import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Distro TV",
    short_name: "Distro TV",
    description: "Ads in your terminal that pay you, while your agent works.",
    start_url: "/",
    display: "browser",
    background_color: "#F7F6F3",
    theme_color: "#0E0E11",
  }
}
