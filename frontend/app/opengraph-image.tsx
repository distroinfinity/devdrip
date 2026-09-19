import { ImageResponse } from "next/og"

export const runtime = "edge"
export const alt = "Distro TV — your terminal's news + market feed, while the agent works."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

// fetch from Google Fonts at runtime to avoid bundling ~570 KB into edge function
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
  const [jetbrainsBold, spaceMono] = await Promise.all([
    loadFont("JetBrains Mono", 700),
    loadFont("Space Mono", 400),
  ])

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#0A0A0C",
        // dot-grid via radial gradient
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
        padding: "60px 80px",
        position: "relative",
      }}
    >
      {/* wordmark */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          fontFamily: "JetBrains Mono",
          fontWeight: 700,
          fontSize: 80,
          color: "#EDEDF0",
          letterSpacing: "-2px",
        }}
      >
        Distro TV
      </div>

      {/* tagline */}
      <div
        style={{
          display: "flex",
          fontFamily: "Space Mono",
          fontSize: 28,
          color: "#8B8B8E",
          marginTop: 16,
          letterSpacing: "-0.5px",
        }}
      >
        your terminal&apos;s news + market feed, while the agent works.
      </div>

      {/* bottom strip */}
      <div
        style={{
          position: "absolute",
          bottom: 40,
          left: 80,
          right: 80,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontFamily: "Space Mono",
          fontSize: 16,
          color: "#55555A",
          letterSpacing: "2px",
        }}
      >
        <span>DISTRO TV</span>
        <span>distrotv.xyz</span>
      </div>
    </div>,
    {
      ...size,
      fonts: [
        {
          name: "JetBrains Mono",
          data: jetbrainsBold,
          weight: 700,
          style: "normal",
        },
        {
          name: "Space Mono",
          data: spaceMono,
          weight: 400,
          style: "normal",
        },
      ],
    }
  )
}
