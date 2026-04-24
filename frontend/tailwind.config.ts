import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", '"Space Mono"', "monospace"],
        body: ["var(--font-body)", '"DM Sans"', "system-ui", "sans-serif"],
        data: ["var(--font-data)", '"JetBrains Mono"', "monospace"],
      },
      colors: {
        // dev drip design tokens
        paper: {
          50: "#FFFFFF",
          100: "#F7F6F3",
          200: "#EEEDEA",
          300: "#E8E7E3",
          400: "#DDDDD8",
          500: "#C5C5BF",
          600: "#9C9CA5",
          700: "#5C5C66",
          800: "#0E0E11",
        },
        ink: {
          50: "#EDEDF0",
          100: "#8A8A94",
          200: "#5C5C66",
          300: "#3A3A40",
          400: "#27272B",
          500: "#1F1F23",
          600: "#18181B",
          700: "#111113",
          800: "#0A0A0C",
        },
        negative: { DEFAULT: "#C13438", surface: "#FCF0F0" },
        caution: { DEFAULT: "#B8860B", surface: "#FBF5E6" },
        // shadcn required colors
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        chart: {
          1: "hsl(var(--chart-1))",
          2: "hsl(var(--chart-2))",
          3: "hsl(var(--chart-3))",
          4: "hsl(var(--chart-4))",
          5: "hsl(var(--chart-5))",
        },
      },
      borderRadius: {
        none: "0px",
        sm: "4px",
        md: "8px",
        lg: "12px",
        pill: "9999px",
      },
      fontSize: {
        hero: ["48px", { lineHeight: "1.1", letterSpacing: "-0.03em" }],
        h1: ["36px", { lineHeight: "1.15", letterSpacing: "-0.02em" }],
        h2: ["28px", { lineHeight: "1.2", letterSpacing: "-0.02em" }],
        h3: ["22px", { lineHeight: "1.3" }],
        h4: ["18px", { lineHeight: "1.35" }],
        body: ["16px", { lineHeight: "1.6" }],
        "body-s": ["14px", { lineHeight: "1.5" }],
        caption: ["12px", { lineHeight: "1.4" }],
        "data-l": ["32px", { lineHeight: "1.1" }],
        "data-m": ["20px", { lineHeight: "1.2" }],
        "data-s": ["14px", { lineHeight: "1.3" }],
        "data-xs": ["12px", { lineHeight: "1.3" }],
      },
      maxWidth: {
        grid: "1200px",
        content: "680px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(14, 14, 17, 0.04)",
        md: "0 2px 8px rgba(14, 14, 17, 0.06)",
        lg: "0 8px 24px rgba(14, 14, 17, 0.08)",
      },
      keyframes: {
        "dot-pulse": {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "0.55" },
        },
        "delta-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "delta-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(-4px)" },
        },
      },
      animation: {
        "dot-pulse": "dot-pulse 3s ease-in-out infinite",
        "delta-in": "delta-in 250ms ease-out forwards",
        "delta-out": "delta-out 150ms ease-in forwards",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
