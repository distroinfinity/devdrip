import type { Metadata } from "next"
import { spaceMono, dmSans, jetbrainsMono } from "@devdrip/design-system/fonts"
import { themeInitScript } from "@devdrip/design-system/theme"
import "./globals.css"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://devdrip.xyz"

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Dev Drip — Dashboard",
  description: "Earnings, impressions, and payouts for your Dev Drip account.",
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceMono.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="font-body antialiased">{children}</body>
    </html>
  )
}
