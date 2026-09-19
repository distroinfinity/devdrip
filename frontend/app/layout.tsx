import type { Metadata } from "next";
import { spaceMono, dmSans, jetbrainsMono } from "@/lib/fonts";
import "@/styles/tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dev Drip — Earn while your agent thinks",
  description:
    "Opt-in developer content during AI coding tool idle time. Earn USDC micropayments on Base.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${spaceMono.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <body className="font-body antialiased">{children}</body>
    </html>
  );
}
