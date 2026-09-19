import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { Nav } from "@/components/landing/nav"
import { Footer } from "@/components/landing/footer"
import { AdComposer } from "@/components/advertisers/ad-composer"
import { AdsTable } from "@/components/advertisers/ads-table"
import { AutoRefresh } from "@/components/advertisers/auto-refresh"
import { StartRow } from "@/components/advertisers/start-row"
import { UnauthenticatedError } from "@/lib/api"
import { listAds, type AdsResult } from "@/lib/advertiser-api"
import { getSession } from "@/lib/session"
import { createAd, setAdStatus } from "./actions"

export const metadata: Metadata = {
  title: "Ad portal — Distro TV",
  description: "Write an ad and run it in developers' terminals.",
  robots: { index: false, follow: false },
}

export const dynamic = "force-dynamic"

const SIGN_IN = "/sign-in?next=/advertisers/portal"

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function AdPortalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const session = await getSession()
  if (!session) redirect(SIGN_IN)

  let result: AdsResult
  try {
    result = await listAds()
  } catch (err) {
    if (err instanceof UnauthenticatedError) redirect(SIGN_IN)
    result = { ads: [], available: false }
  }

  const params = await searchParams
  const initial = {
    brand: first(params["brand"]),
    line: first(params["line"]),
    url: first(params["url"]),
  }

  return (
    <>
      <Nav />
      <main className="bg-[var(--bg-primary)]">
        <div className="mx-auto max-w-[1200px] px-6 py-12 md:py-16">
          <header className="mb-8 flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1
              className="font-display text-[28px] md:text-[34px] leading-[1.1] tracking-[-0.025em] text-[var(--ink-primary)]"
              style={{ fontWeight: 400 }}
            >
              Ad portal
            </h1>
            <p className="m-0 font-data text-[12px] text-[var(--ink-secondary)]">
              pilot · nothing is charged
            </p>
          </header>

          <StartRow />

          <section aria-label="Write an ad" className="mt-10">
            <AdComposer submit={createAd} initial={initial} />
          </section>

          <section className="mt-14">
            <h2
              className="mb-4 font-display text-[20px] tracking-[-0.02em] text-[var(--ink-primary)]"
              style={{ fontWeight: 400 }}
            >
              Your ads
            </h2>
            <AdsTable ads={result.ads} setStatus={setAdStatus} />
          </section>
        </div>
      </main>
      <Footer />
      <AutoRefresh />
    </>
  )
}
