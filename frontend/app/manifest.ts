import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Distro TV",
    short_name: "Distro TV",
    description: "Your terminal's news + market feed, while the agent works.",
    start_url: "/",
    display: "browser",
    background_color: "#F7F6F3",
    theme_color: "#0E0E11",
  }
}
