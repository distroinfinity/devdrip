import { ImageResponse } from "next/og"

// fonts are bundled with the route (no request-time network fetch) so the
// crawler never times out — see app/opengraph-image.tsx for why this matters.
async function loadFonts() {
  const [spaceMono, jetbrains] = await Promise.all([
    fetch(new URL("./fonts/SpaceMono-Regular.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
    fetch(new URL("./fonts/JetBrainsMono-Bold.ttf", import.meta.url)).then((r) => r.arrayBuffer()),
  ])
  return [
    { name: "Space Mono", data: spaceMono, weight: 400 as const },
    { name: "JetBrains Mono", data: jetbrains, weight: 700 as const },
  ]
}

interface CardTheme {
  bg: string
  dot: string
  accent: string
  ink: string
  inkDim: string
  chipBorderOn: string
  chipBorderOff: string
  chipBgOn: string
  chipInkOff: string
}

const LIGHT: CardTheme = {
  bg: "#F7F6F3",
  dot: "rgba(14,14,17,0.10)",
  accent: "#4F46E5",
  ink: "#0E0E11",
  inkDim: "#5C5C66",
  chipBorderOn: "#DDDDD8",
  chipBorderOff: "#C5C5BF",
  chipBgOn: "#FFFFFF",
  chipInkOff: "#9C9CA5",
}

const DARK: CardTheme = {
  bg: "#0A0A0C",
  dot: "rgba(237,237,240,0.08)",
  accent: "#6366F1",
  ink: "#EDEDF0",
  inkDim: "#8A8A94",
  chipBorderOn: "#27272B",
  chipBorderOff: "#3A3A40",
  chipBgOn: "#18181B",
  chipInkOff: "#5C5C66",
}

export const cardThemes = { light: LIGHT, dark: DARK }

export async function renderCard(
  theme: CardTheme,
  size: { width: number; height: number }
): Promise<ImageResponse> {
  const fonts = await loadFonts()

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: theme.bg,
        backgroundImage: `radial-gradient(circle, ${theme.dot} 1px, transparent 1px)`,
        backgroundSize: "16px 16px",
        padding: "56px 64px",
        position: "relative",
      }}
    >
      {/* top: wordmark + eyebrow */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div
          style={{
            display: "flex",
            fontFamily: "JetBrains Mono",
            fontWeight: 700,
            fontSize: 28,
            color: theme.ink,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span>DISTRO</span>
          <span style={{ color: theme.accent, margin: "0 6px" }}>·</span>
          <span>TV</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontFamily: "JetBrains Mono",
            fontSize: 14,
            color: theme.inkDim,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              display: "block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: theme.accent,
              marginRight: 10,
            }}
          />
          CHANNELS · v0.1
        </div>
      </div>

      {/* center: headline — explicit line divs; satori drops bare <br/> */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          fontFamily: "Space Mono",
          fontSize: 56,
          color: theme.ink,
          lineHeight: 1.08,
          letterSpacing: "-0.025em",
        }}
      >
        <div style={{ display: "flex" }}>Channels for your agent&apos;s</div>
        <div style={{ display: "flex" }}>idle minutes.</div>
      </div>

      {/* bottom: chips + meta */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            { label: "CH 01 · NEWS", on: true },
            { label: "CH 02 · MARKETS", on: true },
            { label: "CH 0? · COMING", on: false },
          ].map((c) => (
            <div
              key={c.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: "JetBrains Mono",
                fontSize: 16,
                color: c.on ? theme.ink : theme.chipInkOff,
                border: `1px ${c.on ? "solid" : "dashed"} ${c.on ? theme.chipBorderOn : theme.chipBorderOff}`,
                backgroundColor: c.on ? theme.chipBgOn : "transparent",
                padding: "8px 14px",
                letterSpacing: "0.04em",
              }}
            >
              {c.on && (
                <span
                  style={{
                    display: "block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: theme.accent,
                  }}
                />
              )}
              {c.label}
            </div>
          ))}
        </div>
        <div
          style={{
            display: "flex",
            fontFamily: "JetBrains Mono",
            fontSize: 16,
            color: theme.inkDim,
            letterSpacing: "0.03em",
          }}
        >
          opt-in · &lt; 200ms vanish · subscribe per channel
        </div>
      </div>
    </div>,
    { ...size, fonts }
  )
}
