import type { Metadata } from "next"
import { spaceMono, dmSans, jetbrainsMono } from "@distrotv/design-system/fonts"
import { themeInitScript } from "@distrotv/design-system/theme"
import { Analytics } from "@vercel/analytics/react"
import "@distrotv/design-system/tokens.css"
import "./globals.css"
import { SITE_URL } from "@/lib/env"

const siteUrl = SITE_URL

const title = "Distro TV"
const description =
  "Channels for the moments your agent runs the keyboard. Ambient news, markets, and more — surfaces only while your AI coding tool works."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: [
    "ambient channels",
    "terminal channel surface",
    "ai coding tools",
    "claude code companion",
    "developer news feed",
    "market ticker",
    "distrotv",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Distro TV",
    title,
    description,
    url: siteUrl,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  alternates: {
    canonical: siteUrl,
  },
}

// structured data for search engines
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Distro TV",
      url: siteUrl,
      description,
    },
    {
      "@type": "SoftwareApplication",
      name: "Distro TV",
      applicationCategory: "DeveloperApplication",
      operatingSystem: "Any",
      description,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "Organization",
      name: "Distro TV",
      url: siteUrl,
    },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${spaceMono.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="font-body antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  )
}
