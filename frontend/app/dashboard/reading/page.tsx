import { BlurFade } from "@distrotv/design-system/components/blur-fade"
import { apiFetchOrRefresh } from "@/lib/api"
import { ReadingList } from "@/components/dashboard/reading/reading-list"
import type { ReadingListResponse } from "@/lib/dashboard-api"

export const dynamic = "force-dynamic"

export default async function ReadingPage() {
  const data = await apiFetchOrRefresh<ReadingListResponse>(
    "/me/reading?limit=100",
    "/dashboard/reading"
  )

  return (
    <div className="flex flex-col gap-6">
      <BlurFade delay={0} direction="up" offset={6}>
        <div>
          <p className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
            Reading
          </p>
          <h1 className="mt-2 font-[var(--font-display)] text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--ink-primary)] md:text-[40px]">
            saved stories
            {data.items.length > 0 && (
              <span className="ml-3 font-[var(--font-data)] text-[18px] font-normal text-[var(--ink-tertiary)] tracking-normal">
                {data.items.length}
              </span>
            )}
          </h1>
          <p className="mt-2 font-[var(--font-body)] text-[13px] text-[var(--ink-secondary)]">
            press{" "}
            <kbd className="rounded-none border border-[var(--rule-default)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-[var(--font-data)] text-[11px]">
              s
            </kbd>{" "}
            while a news headline is up in your terminal to save it here.
          </p>
        </div>
      </BlurFade>

      <BlurFade delay={0.04} direction="up" offset={6}>
        <ReadingList initialItems={data.items} hasMore={data.hasMore} />
      </BlurFade>
    </div>
  )
}
