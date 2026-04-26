"use client"

import { cn } from "@/lib/utils"
import { BlurFade } from "@/components/ui/blur-fade"
import { DotGrid } from "@/components/shared/dot-grid"
import { EncryptedText } from "@/components/ui/encrypted-text"
import { InstallButton } from "@/components/shared/install-button"
import { HeroVisual } from "./hero-visual"
import { HeroDataStrip } from "./hero-data-strip"
import { ScrollNudge } from "./scroll-nudge"

export function HeroSection() {
  return (
    <section className="relative overflow-hidden mx-auto max-w-grid px-6 pt-10 pb-6 lg:pt-10 lg:pb-8 min-h-[calc(100svh-60px)] flex flex-col">
      <DotGrid opacity={0.15} variant="static" />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-center">
        {/* left column: headline + subhead + cta */}
        <div>
          {/* headline */}
          <div className="mb-5">
            {/* money figure — min-h prevents CLS during decryption */}
            <div className="mb-2 min-h-[48px] md:min-h-[72px] xl:min-h-[96px]">
              <EncryptedText
                text="$14.72"
                className={cn(
                  "font-data font-bold leading-none tracking-tight",
                  "text-[48px] md:text-[72px] xl:text-[96px]",
                  "text-[var(--ink-primary)]"
                )}
                revealDelayMs={50}
                encryptedClassName="text-[var(--ink-faint)]"
              />
            </div>

            {/* subtitle */}
            <BlurFade delay={0.85} direction="up" duration={0.4} inView>
              <h1
                className={cn(
                  "font-display font-bold",
                  "text-h2 md:text-h1 xl:text-hero",
                  "text-[var(--ink-primary)]"
                )}
              >
                earned this month while
                <br />
                your agent coded.
              </h1>
            </BlurFade>
          </div>

          {/* subhead */}
          <BlurFade delay={1.1} direction="up" duration={0.4} inView>
            <p className="font-body text-[15px] text-[var(--ink-secondary)] max-w-[480px] mb-6 leading-relaxed">
              Verified-human USDC, settled on World Chain.
              <br className="hidden sm:block" />
              Skip anything. Auto-paid every Sunday.
            </p>
          </BlurFade>

          {/* cta */}
          <BlurFade delay={1.35} direction="up" duration={0.35} inView>
            <InstallButton
              href="#install"
              idleLabel="Install"
              className="hover:-translate-y-px hover:shadow-md transition-transform"
            />
          </BlurFade>
        </div>

        {/* right column: hero visual card */}
        <BlurFade delay={1.2} direction="right" blur="10px" duration={0.6} inView>
          <HeroVisual />
        </BlurFade>
      </div>

      {/* data strip + scroll nudge — pushed to bottom of viewport */}
      <div className="mt-auto pt-10">
        <HeroDataStrip />
        <ScrollNudge />
      </div>
    </section>
  )
}
