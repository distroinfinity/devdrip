import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Distro TV — channels for the moments your agent runs the keyboard."
export const size = { width: 1200, height: 675 }
export const contentType = "image/png"

async function loadFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`,
    { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" } }
  ).then((r) => r.text())

  const url = css.match(/src: url\((.+?)\)/)?.[1]
  if (!url) throw new Error(`font url not found for ${family}`)
  return fetch(url).then((r) => r.arrayBuffer())
}

export default async function TwitterImage() {
  const [spaceMono400, jetbrainsBold] = await Promise.all([
    loadFont("Space Mono", 400),
    loadFont("JetBrains Mono", 700),
  ])

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: "#0A0A0C",
        backgroundImage: "radial-gradient(circle, rgba(237,237,240,0.08) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
        padding: "60px 64px",
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
            color: "#EDEDF0",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span>DISTRO</span>
          <span style={{ color: "#6366F1", margin: "0 6px" }}>·</span>
          <span>TV</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontFamily: "JetBrains Mono",
            fontSize: 14,
            color: "#8A8A94",
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
              backgroundColor: "#6366F1",
              marginRight: 10,
            }}
          />
          CHANNELS · v0.1
        </div>
      </div>

      {/* center: headline */}
      <div
        style={{
          display: "flex",
          fontFamily: "Space Mono",
          fontSize: 56,
          color: "#EDEDF0",
          lineHeight: 1.05,
          letterSpacing: "-0.025em",
          maxWidth: "85%",
        }}
      >
        Channels for the moments
        <br />
        your agent runs the keyboard.
      </div>

      {/* bottom */}
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
                color: c.on ? "#EDEDF0" : "#5C5C66",
                border: `1px ${c.on ? "solid" : "dashed"} ${c.on ? "#27272B" : "#3A3A40"}`,
                backgroundColor: c.on ? "#18181B" : "transparent",
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
                    backgroundColor: "#6366F1",
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
            color: "#8A8A94",
            letterSpacing: "0.03em",
          }}
        >
          opt-in · &lt; 200ms vanish · subscribe per channel
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: "Space Mono", data: spaceMono400, weight: 400 },
        { name: "JetBrains Mono", data: jetbrainsBold, weight: 700 },
      ],
    }
  )
}
