import type { Metadata } from "next";
import { spaceMono, dmSans, jetbrainsMono } from "@/lib/fonts";
import "@/styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dev Drip — Earn while your agent thinks",
  description:
    "Opt-in developer content during AI coding tool idle time. Earn real money while your agent codes.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceMono.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var s;try{s=localStorage.getItem("dd-theme")}catch(e){}var t=s==="light"||s==="dark"?s:window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)})()`,
          }}
        />
      </head>
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
