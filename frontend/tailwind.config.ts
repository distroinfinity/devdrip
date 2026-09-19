import type { Config } from "tailwindcss"
import preset from "@distrotv/design-system/tailwind-preset"

const config: Config = {
  presets: [preset as Config],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    // pick up classes declared in shared package
    "../packages/design-system/src/**/*.{ts,tsx}",
  ],
}

export default config
