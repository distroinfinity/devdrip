"use client";

import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { EncryptedText } from "@/components/ui/encrypted-text";
import { WaitlistButton } from "@/components/shared/waitlist-button";
import { HeroVisual } from "./hero-visual";
import { HeroDataStrip } from "./hero-data-strip";

export function HeroSection() {
  return (
    <section className="mx-auto max-w-grid px-6 pt-10 pb-16 lg:pt-10 lg:pb-20">
      <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-10 lg:gap-14 items-center">
        {/* left column: headline + subhead + cta */}
        <div>
          {/* headline */}
          <div className="mb-5">
            {/* money figure */}
            <div className="mb-2">
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
              Opt-in developer content during AI idle time.
              <br className="hidden sm:block" />
              Skip anything. Earn USD.
            </p>
          </BlurFade>

          {/* cta */}
          <BlurFade delay={1.35} direction="up" duration={0.35} inView>
            <WaitlistButton className="hover:-translate-y-px hover:shadow-md transition-transform" />
          </BlurFade>
        </div>

        {/* right column: hero visual card */}
        <BlurFade delay={1.2} direction="right" blur="10px" duration={0.6} inView>
          <HeroVisual />
        </BlurFade>
      </div>

      {/* data strip — sits at/just below fold */}
      <div className="mt-14 lg:mt-16">
        <HeroDataStrip />
      </div>
    </section>
  );
}
