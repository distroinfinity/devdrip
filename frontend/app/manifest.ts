import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dev Drip",
    short_name: "Dev Drip",
    description:
      "Opt-in developer content during AI coding tool idle time. Skip anything. Earn USD.",
    start_url: "/",
    display: "browser",
    background_color: "#F7F6F3",
    theme_color: "#0E0E11",
  };
}
