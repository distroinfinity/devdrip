import { ImageResponse } from "next/og"

export const runtime = "edge"

async function loadFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`,
    {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      },
    }
  ).then((r) => r.text())

  const url = css.match(/src: url\((.+?)\)/)?.[1]
  if (!url) throw new Error(`font url not found for ${family}`)
  return fetch(url).then((r) => r.arrayBuffer())
}

export async function GET() {
  const [spaceMonoBold, spaceMono] = await Promise.all([
    loadFont("Space Mono", 700),
    loadFont("Space Mono", 400),
  ])

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0A0A0C",
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
        padding: "0 120px",
        position: "relative",
      }}
    >
      {/* brand mark */}
      <div
        style={{
          width: 100,
          height: 100,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0E0E11",
          borderRadius: 20,
          marginRight: 48,
          boxShadow: "0 0 60px rgba(99,102,241,0.12)",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 26,
            height: 45,
            backgroundColor: "#EDEDF0",
            borderRadius: "0 0 13px 13px",
            opacity: 0.9,
          }}
        />
      </div>

      {/* text stack */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            fontFamily: "Space Mono",
            fontWeight: 700,
            fontSize: 56,
            color: "#EDEDF0",
            letterSpacing: "-1px",
          }}
        >
          dev drip
        </div>
        <div
          style={{
            fontFamily: "Space Mono",
            fontWeight: 400,
            fontSize: 22,
            color: "#8A8A94",
            marginTop: 12,
            letterSpacing: "-0.3px",
          }}
        >
          Earn USD while your AI agent thinks.
        </div>
      </div>

      {/* watermark */}
      <div
        style={{
          position: "absolute",
          bottom: 70,
          right: 120,
          fontFamily: "Space Mono",
          fontWeight: 400,
          fontSize: 14,
          color: "#5C5C66",
          letterSpacing: "2px",
        }}
      >
        devdrip.xyz
      </div>
    </div>,
    {
      width: 1500,
      height: 500,
      fonts: [
        {
          name: "Space Mono",
          data: spaceMonoBold,
          weight: 700,
          style: "normal" as const,
        },
        {
          name: "Space Mono",
          data: spaceMono,
          weight: 400,
          style: "normal" as const,
        },
      ],
    }
  )
}
