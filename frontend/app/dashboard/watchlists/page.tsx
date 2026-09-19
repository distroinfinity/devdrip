import { BlurFade } from "@distrotv/design-system/components/blur-fade"
import { apiFetchOrRefresh } from "@/lib/api"
import type { WatchlistDto, SparklineDto } from "@distrotv/shared"
import { WatchlistsClient } from "./watchlists-client"

export const dynamic = "force-dynamic"

export default async function WatchlistsPage() {
  const [{ watchlists }, { sparklines }] = await Promise.all([
    apiFetchOrRefresh<{ watchlists: WatchlistDto[] }>("/me/watchlists", "/dashboard/watchlists"),
    apiFetchOrRefresh<{ sparklines: SparklineDto[] }>(
      "/me/watchlist/sparklines?windowSec=86400",
      "/dashboard/watchlists"
    ).catch(() => ({ sparklines: [] as SparklineDto[] })),
  ])

  return (
    <div className="flex flex-col gap-6">
      <BlurFade delay={0} direction="up" offset={6}>
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
            Watchlists
          </p>
          <h1 className="mt-2 font-display text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--ink-primary)] md:text-[40px]">
            your tickers
          </h1>
          <p className="mt-2 font-body text-[13px] text-[var(--ink-secondary)]">
            saved server-side. fetcher pulls quotes every 60s. cli picks up changes within 30 min —
            or instantly on the next daemon restart.
          </p>
        </div>
      </BlurFade>

      <BlurFade delay={0.04} direction="up" offset={6}>
        <WatchlistsClient initial={watchlists} sparklines={sparklines} />
      </BlurFade>
    </div>
  )
}
