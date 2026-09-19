"use client";

import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { NumberTicker } from "@/components/ui/number-ticker";

type TickerMetric = {
  label: string;
  prefix?: string;
  suffix?: string;
  value: number;
  decimals: number;
};

type StaticMetric = {
  label: string;
  static: string;
};

type Metric = TickerMetric | StaticMetric;

const METRICS: Metric[] = [
  { label: "THIS MONTH", prefix: "$", value: 14.72, decimals: 2 },
  { label: "REVENUE SHARE", suffix: "%", value: 70, decimals: 0 },
  { label: "DISMISS", static: "<200ms" },
];

// base stagger offset for the data strip entrance
const BASE_DELAY = 2.0;
const STAGGER = 0.15;

interface HeroDataStripProps {
  className?: string;
}

export function HeroDataStrip({ className }: HeroDataStripProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* top rule */}
      <div className="h-px bg-[var(--rule-default)] mb-6" />

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-3 lg:gap-0">
        {METRICS.map((metric, i) => (
          <BlurFade
            key={metric.label}
            delay={BASE_DELAY + i * STAGGER}
            direction="up"
            duration={0.4}
            inView
          >
            <div
              className={cn(
                "lg:flex-1",
                // rule dividers on desktop between items
                i > 0 && "lg:border-l lg:border-[var(--rule-default)] lg:pl-6"
              )}
            >
              <div className="font-body text-[9px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.08em] mb-1.5">
                {metric.label}
              </div>
              <div className="font-data text-[18px] font-bold text-[var(--ink-primary)]">
                {"static" in metric ? (
                  (metric as StaticMetric).static
                ) : (
                  <>
                    {(metric as TickerMetric).prefix}
                    <NumberTicker
                      value={(metric as TickerMetric).value}
                      decimalPlaces={(metric as TickerMetric).decimals}
                      delay={BASE_DELAY + i * STAGGER + 0.1}
                    />
                    {(metric as TickerMetric).suffix}
                  </>
                )}
              </div>
            </div>
          </BlurFade>
        ))}
      </div>
    </div>
  );
}
