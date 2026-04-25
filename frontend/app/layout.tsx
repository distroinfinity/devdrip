import type { Metadata } from "next";
import { spaceMono, dmSans, jetbrainsMono } from "@/lib/fonts";
import { Analytics } from "@vercel/analytics/react";
import "@/styles/tokens.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://devdrip.xyz";

const title = "Dev Drip — Earn while your AI agent codes";
const description =
  "Opt-in developer content during AI coding tool idle time. Skip anything. Earn USD. Offset your Copilot and Cursor subscriptions.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: [
    "developer earnings",
    "AI coding tool costs",
    "earn while coding",
    "developer passive income",
    "offset copilot subscription",
    "cursor subscription cost",
    "developer tool idle time",
    "opt-in developer ads",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    siteName: "Dev Drip",
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
};

// structured data for search engines
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      name: "Dev Drip",
      url: siteUrl,
      description,
    },
    {
      "@type": "SoftwareApplication",
      name: "Dev Drip",
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
      name: "Dev Drip",
      url: siteUrl,
    },
  ],
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
  );
}
