import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "Dev Drip — Earn USD while your AI agent codes. Opt-in developer content during idle time.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const [jetbrainsBold, spaceMono] = await Promise.all([
    fetch(new URL("../public/fonts/JetBrainsMono-Bold.ttf", import.meta.url)).then(
      (r) => r.arrayBuffer(),
    ),
    fetch(new URL("../public/fonts/SpaceMono-Regular.ttf", import.meta.url)).then(
      (r) => r.arrayBuffer(),
    ),
  ]);

  return new ImageResponse(
    (
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
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          padding: "60px 80px",
          position: "relative",
        }}
      >
        {/* earnings display */}
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            fontFamily: "JetBrains Mono",
            fontWeight: 700,
            fontSize: 96,
            color: "#EDEDF0",
            textShadow: "0 0 60px rgba(99,102,241,0.4), 0 0 120px rgba(99,102,241,0.15)",
            letterSpacing: "-2px",
          }}
        >
          $14.72
        </div>

        {/* tagline */}
        <div
          style={{
            display: "flex",
            fontFamily: "Space Mono",
            fontSize: 30,
            color: "#8B8B8E",
            marginTop: 12,
            letterSpacing: "-0.5px",
          }}
        >
          earned this month while your agent coded.
        </div>

        {/* subline */}
        <div
          style={{
            display: "flex",
            fontFamily: "Space Mono",
            fontSize: 20,
            color: "#55555A",
            marginTop: 24,
            letterSpacing: "-0.3px",
          }}
        >
          Opt-in developer content during AI idle time. Skip anything. Earn USD.
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
          <span>DEV DRIP</span>
          <span>devdrip.xyz</span>
        </div>
      </div>
    ),
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
    },
  );
}
