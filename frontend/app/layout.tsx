import type { Metadata } from "next"
import { spaceMono, dmSans, jetbrainsMono } from "@distrotv/design-system/fonts"
import { themeInitScript } from "@distrotv/design-system/theme"
import { Analytics } from "@vercel/analytics/react"
import "@distrotv/design-system/tokens.css"
import "./globals.css"

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://distrotv.xyz"

const title = "Distro TV"
const description = "Your terminal's news + market feed, while the agent works."

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: [
    "terminal news feed",
    "developer news",
    "market feed",
    "ai agent idle",
    "developer tool",
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
