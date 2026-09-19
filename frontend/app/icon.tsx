import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default async function Icon() {
  const spaceMono = await fetch(
    new URL("../public/fonts/SpaceMono-Regular.ttf", import.meta.url),
  ).then((r) => r.arrayBuffer());

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
        <span
          style={{
            fontFamily: "Space Mono",
            fontSize: 18,
            fontWeight: 400,
            color: "#EDEDF0",
            letterSpacing: "-1.5px",
            lineHeight: 1,
          }}
        >
          dd
        </span>
      </div>
    ),
    {
      ...size,
      fonts: [
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
