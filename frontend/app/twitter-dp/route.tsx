import { ImageResponse } from "next/og"

export const runtime = "edge"

export async function GET() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#0A0A0C",
        backgroundImage: "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
        backgroundSize: "16px 16px",
      }}
    >
      {/* brand mark — scaled from icon.tsx (32→200) */}
      <div
        style={{
          width: 200,
          height: 200,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0E0E11",
          borderRadius: 40,
          boxShadow: "0 0 80px rgba(99,102,241,0.15)",
        }}
      >
        <div
          style={{
            width: 52,
            height: 90,
            backgroundColor: "#EDEDF0",
            borderRadius: "0 0 26px 26px",
            opacity: 0.9,
          }}
        />
      </div>
    </div>,
    { width: 400, height: 400 }
  )
}
