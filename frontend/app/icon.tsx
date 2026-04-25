import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

async function loadFont(family: string, weight: number): Promise<ArrayBuffer> {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:wght@${weight}`,
    { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)" } },
  ).then((r) => r.text());

  const url = css.match(/src: url\((.+?)\)/)?.[1];
  if (!url) throw new Error(`font url not found for ${family}`);
  return fetch(url).then((r) => r.arrayBuffer());
}

export default async function Icon() {
  const spaceMono = await loadFont("Space Mono", 400);

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
