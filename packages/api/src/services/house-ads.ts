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

// demo creatives for local development: recognisable dev tools so the rotation looks real.
// never shown in production — a public user would read them as paying advertisers.
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

// what fills unsold slots in production: Distro TV's own promos, nothing else
export const OWN_HOUSE_ADS: NormalizedAd[] = [
  h(
    "own-advertise",
    "Distro TV",
    "Your ad here. Reach developers while their agent works.",
    "Advertise",
    "https://distrotv.xyz/advertisers"
  ),
  h(
    "own-portal",
    "Distro TV",
    "Write one line. It runs in developers' terminals within minutes.",
    "Open the portal",
    "https://distrotv.xyz/advertisers/portal"
  ),
  h(
    "own-revenue",
    "Distro TV",
    "See what your idle agent time has earned so far.",
    "Open revenue",
    "https://distrotv.xyz/dashboard/revenue"
  ),
  h(
    "own-channels",
    "Distro TV",
    "Prefer no ads? Tune this slot to news or markets instead.",
    "Preferences",
    "https://distrotv.xyz/dashboard/preferences"
  ),
]

export function houseAdsFor(production: boolean): NormalizedAd[] {
  return production ? OWN_HOUSE_ADS : HOUSE_ADS
}

export function houseAd(
  index: number,
  production = process.env["NODE_ENV"] === "production"
): NormalizedAd {
  const list = houseAdsFor(production)
  const ad = list[((index % list.length) + list.length) % list.length]
  if (!ad) throw new Error("house_ads_empty")
  return ad
}
