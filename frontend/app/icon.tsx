import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// matches the navbar logo: dark rounded square with white droplet/shield shape
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0E0E11",
          borderRadius: 6,
        }}
      >
        <div
          style={{
            width: 8,
            height: 14,
            backgroundColor: "#EDEDF0",
            borderRadius: "0 0 4px 4px",
            opacity: 0.9,
          }}
        />
      </div>
    ),
    { ...size },
  );
}
