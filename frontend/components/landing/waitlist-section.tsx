"use client";

import { useState, useRef, useEffect } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { DotGrid } from "@/components/shared/dot-grid";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";

const EMAIL_PLACEHOLDERS = [
  "your@email.com",
  "developer@startup.io",
  "coder@bangalore.dev",
  "hacker@localhost",
];

// simple email check — the vanish input uses type="text" (canvas pixel
// detection breaks with type="email"), so we validate here instead
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

type Phase = "idle" | "submitting" | "success";

export function WaitlistSection() {
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isValidEmail(email)) return;

    setPhase("submitting");

    // no backend yet (P0-015) — simulate network delay
    timerRef.current = setTimeout(() => setPhase("success"), 1200);
  };

  return (
    <section
      id="waitlist"
      aria-labelledby="waitlist-heading"
      className="relative bg-[var(--bg-secondary)] overflow-hidden scroll-mt-20"
    >
      <DotGrid opacity={0.18} variant="heartbeat" />

      <div className="relative mx-auto max-w-grid px-6 py-20">
        <div className="flex flex-col items-center text-center gap-6">
          <BlurFade inView delay={0}>
            <div className="flex flex-col items-center">
              <div className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.1em] mb-3">
                Early Access
              </div>
              <h2
                id="waitlist-heading"
                className="font-display text-h2 md:text-h1 font-bold text-[var(--ink-primary)] tracking-[-0.02em] mb-4"
              >
                Dev Drip is in active development.
              </h2>
              <p className="font-body text-body text-[var(--ink-secondary)] max-w-[520px]">
                The idle engine works. Terminal TV renders. The payment rail is
                integrated. We&rsquo;re onboarding developers in waves.
              </p>
            </div>
          </BlurFade>

          <BlurFade inView delay={0.1} className="w-full max-w-xl">
            {phase === "success" ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <span className="font-display text-[20px] font-bold text-[var(--ink-primary)]">
                  You&rsquo;re in.
                </span>
                <span className="font-body text-[13px] text-[var(--ink-tertiary)]">
                  We&rsquo;ll email you once. When it&rsquo;s your turn.
                </span>
              </div>
            ) : (
              <div className={phase === "submitting" ? "opacity-50 pointer-events-none" : ""}>
                <PlaceholdersAndVanishInput
                  placeholders={EMAIL_PLACEHOLDERS}
                  onChange={(e) => setEmail(e.target.value)}
                  onSubmit={handleSubmit}
                />
              </div>
            )}
          </BlurFade>

          {/* uncomment when count > 500:
          <BlurFade inView delay={0.15}>
            <span className="font-data text-[11px] tabular-nums text-[var(--ink-faint)]">
              2,847 developers waiting
            </span>
          </BlurFade>
          */}
        </div>
      </div>
    </section>
  );
}
