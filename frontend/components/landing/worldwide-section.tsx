"use client";

import { useRef } from "react";
import { motion, useInView } from "motion/react";
import { BlurFade } from "@/components/ui/blur-fade";
import { DotGrid } from "@/components/shared/dot-grid";
import { NumberTicker } from "@/components/ui/number-ticker";
import { cn } from "@/lib/utils";

// --- data ---

const ANNUAL_AI_COST = 20 * 12; // $240/yr

interface MarketData {
  country: string;
  medianSalary: number;
  percentOfIncome: number;
}

const MARKETS: MarketData[] = [
  { country: "United States", medianSalary: 132_270 },
  { country: "India", medianSalary: 6_750 },
  { country: "Brazil", medianSalary: 18_000 },
  { country: "Nigeria", medianSalary: 7_200 },
].map((m) => ({
  ...m,
  percentOfIncome: parseFloat(((ANNUAL_AI_COST / m.medianSalary) * 100).toFixed(2)),
}));

const MAX_PERCENT = Math.max(...MARKETS.map((m) => m.percentOfIncome));

// --- bar row ---

function MarketBar({
  market,
  index,
  isInView,
}: {
  market: MarketData;
  index: number;
  isInView: boolean;
}) {
  const barWidth = (market.percentOfIncome / MAX_PERCENT) * 100;

  return (
    <div
      className={cn(
        "grid grid-cols-[100px_1fr_56px] lg:grid-cols-[160px_1fr_80px] items-center gap-3 py-3",
        index < MARKETS.length - 1 && "border-b border-[var(--rule-subtle)]",
      )}
    >
      {/* country + salary */}
      <div className="min-w-0">
        <div className="font-body text-[14px] font-semibold text-[var(--ink-primary)] leading-tight truncate">
          {market.country}
        </div>
        <div className="font-data text-[11px] text-[var(--ink-tertiary)] tabular-nums mt-0.5">
          ${market.medianSalary.toLocaleString()}/yr
        </div>
      </div>

      {/* animated bar */}
      <div className="h-6 rounded-sm bg-[var(--bg-inset)] overflow-hidden">
        <motion.div
          className="h-full rounded-sm bg-[var(--ink-primary)]"
          initial={{ width: 0 }}
          animate={isInView ? { width: `${barWidth}%` } : { width: 0 }}
          transition={{
            duration: 0.8,
            delay: index * 0.15,
            ease: [0.16, 1, 0.3, 1],
          }}
        />
      </div>

      {/* percentage */}
      <div className="text-right">
        <span className="font-data text-[15px] font-bold text-[var(--ink-primary)] tabular-nums">
          <NumberTicker
            value={market.percentOfIncome}
            decimalPlaces={2}
            delay={0.2 + index * 0.15}
          />
          <span>%</span>
        </span>
      </div>
    </div>
  );
}

// --- income comparison chart ---

function IncomeComparisonBars() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-50px" });

  return (
    <div ref={ref} className="w-full max-w-content">
      {MARKETS.map((market, i) => (
        <MarketBar key={market.country} market={market} index={i} isInView={isInView} />
      ))}

      {/* source footnote */}
      <div className="text-right mt-3">
        <span className="text-[11px] text-[var(--ink-faint)]">
          Median developer salaries — Glassdoor, Levels.fyi, 2025
        </span>
      </div>
    </div>
  );
}

// --- section ---

export function WorldwideSection() {
  return (
    <section
      id="worldwide"
      aria-labelledby="worldwide-heading"
      className="relative bg-[var(--bg-primary)] overflow-hidden scroll-mt-20"
    >
      <DotGrid opacity={0.35} variant="heartbeat" />

      <div className="relative mx-auto max-w-grid px-6 py-20">
        <div className="flex flex-col items-center text-center gap-8 lg:gap-12">
          {/* header */}
          <BlurFade inView>
            <div className="flex flex-col items-center">
              <div className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.1em] mb-3">
                For Developers Worldwide
              </div>
              <h2
                id="worldwide-heading"
                className="font-display text-h2 md:text-h1 font-bold text-[var(--ink-primary)] tracking-[-0.02em] mb-4"
              >
                Same tools, different math.
              </h2>
            </div>
          </BlurFade>

          {/* copy block */}
          <BlurFade inView delay={0.1}>
            <div className="max-w-content text-left lg:text-center">
              <p className="font-body text-body text-[var(--ink-secondary)] mb-4">
                A $20/month AI subscription is 0.2% of a US developer&apos;s
                annual income. For a developer in Bangalore, Lagos, or São
                Paulo, it&apos;s closer to 3–5%.
              </p>
              <p className="font-body text-body font-semibold text-[var(--ink-primary)]">
                Dev Drip exists so the cost of AI tools doesn&apos;t determine
                who gets to use them.
              </p>
            </div>
          </BlurFade>

          {/* bar chart */}
          <BlurFade inView delay={0.2}>
            <IncomeComparisonBars />
          </BlurFade>
        </div>
      </div>
    </section>
  );
}
