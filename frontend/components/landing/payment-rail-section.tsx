"use client";

import { useRef } from "react";
import { Wallet } from "lucide-react";
import { BlurFade } from "@/components/ui/blur-fade";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { DotGrid } from "@/components/shared/dot-grid";

// --- feature bullets data ---

const FEATURE_BULLETS = [
  "Real-time balance visible in your dashboard and CLI",
  "Minimum payout: $1.00 (1–2 days of use)",
  "Cash out to your bank anytime",
  "More rails coming — Stripe, PayPal, UPI",
] as const;

// --- sub-components ---

function UsdcBadge() {
  return (
    <span className="inline-block bg-[var(--bg-inset)] font-body text-[10px] uppercase tracking-[0.08em] text-[var(--ink-secondary)] px-2 py-0.5 rounded-sm mb-4">
      Micropayments on Base
    </span>
  );
}

const nodeCard = "rounded-md border border-[var(--rule-default)] bg-[var(--bg-surface)] px-4 py-3 flex items-center gap-3 w-fit";

function PlatformNode({ nodeRef }: { nodeRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={nodeRef} className={nodeCard}>
      <span className="font-display text-[18px] font-bold text-[var(--ink-primary)] leading-none">
        DD
      </span>
      <div>
        <div className="font-body text-body-s font-semibold text-[var(--ink-primary)] leading-tight">
          Dev Drip
        </div>
        <div className="font-body text-[10px] text-[var(--ink-tertiary)] uppercase tracking-[0.06em]">
          platform
        </div>
      </div>
    </div>
  );
}

function WalletNode({ nodeRef }: { nodeRef?: React.Ref<HTMLDivElement> }) {
  return (
    <div ref={nodeRef} className={nodeCard}>
      <Wallet className="w-5 h-5 text-[var(--ink-primary)]" strokeWidth={1.5} />
      <div>
        <div className="font-body text-body-s font-semibold text-[var(--ink-primary)] leading-tight">
          Your Wallet
        </div>
        <div className="font-data text-[10px] text-[var(--ink-tertiary)] tabular-nums">
          0xA1b2...F9e3
        </div>
      </div>
    </div>
  );
}

function FeeComparison() {
  return (
    <div className="flex flex-col items-center gap-1 mt-3">
      <span className="font-data text-[10px] text-[var(--ink-tertiary)]">
        per transaction
      </span>
      <span className="font-data text-data-m font-bold text-[var(--ink-primary)] tabular-nums">
        $0.002
      </span>
      <span className="font-data text-data-xs text-[var(--ink-tertiary)] line-through tabular-nums">
        $0.30–$0.50
      </span>
    </div>
  );
}

// desktop beam + mobile fallback
function TransactionFlowDemo() {
  const containerRef = useRef<HTMLDivElement>(null);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex flex-col items-center gap-6">
      {/* desktop: horizontal beam */}
      <div
        ref={containerRef}
        className="relative hidden lg:flex items-center justify-between w-full gap-8"
      >
        <PlatformNode nodeRef={fromRef} />
        {/* tx amount label near the beam */}
        <span className="absolute left-1/2 -translate-x-1/2 -top-1 font-data text-[10px] text-[var(--ink-tertiary)] tabular-nums">
          $0.03
        </span>
        <WalletNode nodeRef={toRef} />
        <AnimatedBeam
          containerRef={containerRef}
          fromRef={fromRef}
          toRef={toRef}
          gradientStartColor="var(--ink-tertiary)"
          gradientStopColor="var(--ink-primary)"
          pathColor="var(--ink-faint)"
          pathOpacity={0.2}
          curvature={0}
          duration={5}
        />
      </div>

      {/* mobile: vertical stack with dashed connector */}
      <div className="flex lg:hidden flex-col items-center gap-0">
        <PlatformNode />
        <div className="relative flex flex-col items-center py-2">
          <div className="w-px h-12 border-l border-dashed border-[var(--ink-faint)] animate-pulse" />
          <span className="absolute top-1/2 -translate-y-1/2 left-4 font-data text-[10px] text-[var(--ink-tertiary)] tabular-nums">
            $0.03
          </span>
        </div>
        <WalletNode />
      </div>

      <FeeComparison />
    </div>
  );
}

function FeatureBullets() {
  return (
    <ul className="space-y-3">
      {FEATURE_BULLETS.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="font-data text-data-xs text-[var(--ink-tertiary)] mt-0.5 shrink-0">
            →
          </span>
          <span
            className="font-body text-body-s text-[var(--ink-secondary)] leading-relaxed"
            dangerouslySetInnerHTML={{
              __html: item.replace(
                /(\$[\d.]+)/g,
                '<span class="font-data tabular-nums">$1</span>'
              ),
            }}
          />
        </li>
      ))}
    </ul>
  );
}

// --- section ---

export function PaymentRailSection() {
  return (
    <section
      id="payment-rail"
      aria-labelledby="payment-rail-heading"
      className="relative bg-[var(--bg-secondary)] overflow-hidden"
    >
      <DotGrid opacity={0.3} variant="heartbeat" />

      <div className="relative mx-auto max-w-grid px-6 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* left — copy */}
          <div>
            <BlurFade inView delay={0}>
              <div className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.1em] mb-3">
                The Payment Rail
              </div>
              <UsdcBadge />
              <h2
                id="payment-rail-heading"
                className="font-display text-h2 md:text-h1 font-bold text-[var(--ink-primary)] tracking-[-0.02em] mb-6"
              >
                Your money, your way.
              </h2>
            </BlurFade>

            <BlurFade inView delay={0.1}>
              <div className="max-w-content space-y-4 mb-8">
                <p className="font-body text-body text-[var(--ink-secondary)] leading-[1.6]">
                  We start with USD on Base (Coinbase&apos;s L2) because
                  micropayments demand it. Transaction fees:{" "}
                  <span className="font-data tabular-nums font-semibold text-[var(--ink-primary)]">
                    $0.002
                  </span>
                  . Traditional payment rails charge{" "}
                  <span className="font-data tabular-nums text-[var(--ink-tertiary)] line-through">
                    $0.30–$0.50
                  </span>{" "}
                  minimum — which makes sending someone{" "}
                  <span className="font-data tabular-nums">$0.03</span>{" "}
                  impossible.
                </p>
                <p className="font-body text-body text-[var(--ink-secondary)] leading-[1.6]">
                  But this is just the beginning. Stripe, PayPal, UPI, and
                  direct bank transfers are on the roadmap. Pick the rail that
                  works for you.
                </p>
              </div>
            </BlurFade>

            <BlurFade inView delay={0.15}>
              <FeatureBullets />
            </BlurFade>
          </div>

          {/* right — beam demo */}
          <BlurFade inView delay={0.2}>
            <TransactionFlowDemo />
          </BlurFade>
        </div>
      </div>
    </section>
  );
}
