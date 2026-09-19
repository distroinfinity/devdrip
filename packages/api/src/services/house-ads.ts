import type { NormalizedAd } from "./carbon-ad.provider.js"

function h(
  slug: string,
  advertiser: string,
  headline: string,
  ctaText: string,
  targetUrl: string
): NormalizedAd {
  return {
    adId: `house:${slug}`,
    source: "house",
    advertiser,
    headline,
    ctaText,
    targetUrl,
    clickBeaconUrl: null,
    viewBeaconUrl: null,
  }
}

// demo creatives shown when carbon has no fill. not sold inventory.
export const HOUSE_ADS: NormalizedAd[] = [
  h(
    "distro-advertise",
    "Distro TV",
    "Your ad here. Reach developers while their agent works.",
    "Advertise",
    "https://distrotv.xyz/advertisers"
  ),
  h(
    "railway",
    "Railway",
    "Ship your app in minutes. Infrastructure that gets out of the way.",
    "Deploy now",
    "https://railway.com"
  ),
  h(
    "neon",
    "Neon",
    "Serverless Postgres with branching. A database for every pull request.",
    "Start free",
    "https://neon.tech"
  ),
  h(
    "sentry",
    "Sentry",
    "See the error, the commit, and the fix. Monitoring built for developers.",
    "Try Sentry",
    "https://sentry.io"
  ),
  h(
    "posthog",
    "PostHog",
    "Product analytics, session replay and feature flags in one place.",
    "Get started",
    "https://posthog.com"
  ),
  h(
    "vercel",
    "Vercel",
    "Build and deploy the web. Preview every change before it ships.",
    "Deploy",
    "https://vercel.com"
  ),
  h(
    "linear",
    "Linear",
    "Plan and build products. Issue tracking your team will actually use.",
    "Try Linear",
    "https://linear.app"
  ),
  h(
    "supabase",
    "Supabase",
    "Postgres, auth, storage and realtime. Build in a weekend, scale to millions.",
    "Start project",
    "https://supabase.com"
  ),
]

export function houseAd(index: number): NormalizedAd {
  const ad = HOUSE_ADS[((index % HOUSE_ADS.length) + HOUSE_ADS.length) % HOUSE_ADS.length]
  if (!ad) throw new Error("house_ads_empty")
  return ad
}
