import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Distro TV — channels for the moments your agent runs the keyboard."
export const size = { width: 1200, height: 630 }
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

export default async function OgImage() {
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
        backgroundColor: "#F7F6F3",
        backgroundImage: "radial-gradient(circle, rgba(14,14,17,0.10) 1px, transparent 1px)",
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
            color: "#0E0E11",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          <span>DISTRO</span>
          <span style={{ color: "#4F46E5", margin: "0 6px" }}>·</span>
          <span>TV</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontFamily: "JetBrains Mono",
            fontSize: 14,
            color: "#5C5C66",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: "#4F46E5",
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
          color: "#0E0E11",
          lineHeight: 1.05,
          letterSpacing: "-0.025em",
          maxWidth: "85%",
        }}
      >
        Channels for the moments
        <br />
        your agent runs the keyboard.
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
                color: c.on ? "#0E0E11" : "#9C9CA5",
                border: `1px ${c.on ? "solid" : "dashed"} ${c.on ? "#DDDDD8" : "#C5C5BF"}`,
                backgroundColor: c.on ? "#FFFFFF" : "transparent",
                padding: "8px 14px",
                letterSpacing: "0.04em",
              }}
            >
              {c.on && (
                <span
                  style={{
                    display: "inline-block",
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "#4F46E5",
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
            color: "#5C5C66",
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
