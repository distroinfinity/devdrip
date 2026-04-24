import { BlurFade } from "@devdrip/design-system/components/blur-fade"
import { apiFetchOrRefresh } from "@/lib/api"
import { PreferencesForm } from "@/components/dashboard/preferences/preferences-form"
import type { PreferencesPayload } from "@/lib/dashboard-api"

export const dynamic = "force-dynamic"

export default async function PreferencesPage() {
  const { preferences } = await apiFetchOrRefresh<PreferencesPayload>(
    "/me/preferences",
    "/dashboard/preferences"
  )

  return (
    <div className="flex flex-col gap-6">
      <BlurFade delay={0} direction="up" offset={6}>
        <div>
          <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
            Preferences
          </p>
          <h1 className="mt-2 font-display text-[32px] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--ink-primary)] md:text-[40px]">
            your rules
          </h1>
          <p className="mt-2 font-body text-[13px] text-[var(--ink-secondary)]">
            saved to dashboard. cli picks up changes within 30 min — or instantly on the next daemon
            restart.
          </p>
        </div>
      </BlurFade>

      <BlurFade delay={0.04} direction="up" offset={6}>
        <PreferencesForm initial={preferences} />
      </BlurFade>
    </div>
  )
}
