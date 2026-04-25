// js-accessible design token values for framer-motion, inline styles, etc.
export const tokens = {
  fonts: {
    display: '"Space Mono", monospace',
    body: '"DM Sans", system-ui, sans-serif',
    data: '"JetBrains Mono", monospace',
  },
  timing: {
    micro: 100,
    fast: 150,
    default: 200,
    smooth: 300,
    slow: 400,
    vanish: 120,
  },
  easing: {
    smooth: [0.16, 1, 0.3, 1] as const,
    default: "ease-in-out",
  },
  grid: {
    maxWidth: 1200,
    contentMax: 680,
    gutter: 16,
  },
  dotGrid: {
    size: 1,
    spacing: 16,
    spacingWide: 24,
  },
  accent: {
    light: { DEFAULT: "#4F46E5", hover: "#4338CA", glow: "rgba(79,70,229,0.15)", muted: "#C7D2FE" },
    dark: { DEFAULT: "#6366F1", hover: "#818CF8", glow: "rgba(99,102,241,0.2)", muted: "#312E81" },
  },
} as const;

// terminal TV is always dark regardless of theme
export const terminalColors = {
  bg: "#0E0E11",
  bgInset: "#16161A",
  border: "#2A2A2E",
  text: "#EDEDF0",
  textSecondary: "#8A8A94",
  textTertiary: "#5C5C66",
  textFaint: "#3A3A40",
} as const;
