import type { Config } from "tailwindcss"
import preset from "@devdrip/design-system/tailwind-preset"

const config: Config = {
  presets: [preset as Config],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    // classes defined inside the shared package
    "../../packages/design-system/src/**/*.{ts,tsx}",
  ],
}

export default config
