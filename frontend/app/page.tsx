import { DotGrid } from "@/components/shared/dot-grid";
import { DataStrip } from "@/components/shared/data-strip";
import { ProgressBar } from "@/components/shared/progress-bar";
import { EarningsCounter } from "@/components/shared/earnings-counter";
import { DigestCard } from "@/components/shared/digest-card";
import { TerminalTV } from "@/components/shared/terminal-tv";
import { ThemeToggle } from "@/components/shared/theme-toggle";

export default function Home() {
  return (
    <main className="relative min-h-screen">
      <DotGrid opacity={0.3} />

      <div className="relative mx-auto max-w-grid px-6 py-12">
        {/* header */}
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-[5px] bg-[var(--ink-primary)] flex items-center justify-center">
              <div className="w-1.5 h-2.5 rounded-b-sm bg-[var(--ink-inverse)] opacity-90" />
            </div>
            <span className="font-display text-[17px] font-bold tracking-tight">
              dev drip
            </span>
            <span className="font-data text-[9px] font-medium tracking-[0.06em] border border-[var(--rule-default)] text-[var(--ink-tertiary)] px-1.5 py-0.5 rounded-[3px]">
              v0.1
            </span>
          </div>
          <ThemeToggle />
        </div>

        {/* title */}
        <h1 className="font-display text-hero font-bold mb-2">
          Component Library
        </h1>
        <p className="font-body text-body text-[var(--ink-secondary)] mb-12 max-w-content">
          Design system verification — all core primitives rendered with the
          Industrial Paper design token system.
        </p>

        <div className="space-y-16">
          {/* data strip */}
          <section>
            <SectionLabel>DataStrip</SectionLabel>
            <DataStrip
              data={[
                { label: "THIS MONTH", value: "$14.72" },
                { label: "IMPRESSIONS", value: "2,725" },
                { label: "AVG eCPM", value: "$15.40" },
                { label: "SURFACES", value: "5 active" },
              ]}
            />
          </section>

          {/* earnings counter */}
          <section>
            <SectionLabel>EarningsCounter</SectionLabel>
            <div className="bg-[var(--bg-surface)] border border-[var(--rule-default)] rounded-md p-6 inline-block relative overflow-hidden">
              <DotGrid opacity={0.2} />
              <div className="relative">
                <EarningsCounter />
              </div>
            </div>
          </section>

          {/* terminal tv */}
          <section>
            <SectionLabel>TerminalTV</SectionLabel>
            <p className="font-body text-body-s text-[var(--ink-tertiary)] mb-3">
              Click to focus, then press S / D / M keys.
            </p>
            <div className="max-w-sm">
              <TerminalTV />
            </div>
          </section>

          {/* digest card */}
          <section>
            <SectionLabel>DigestCard</SectionLabel>
            <div className="max-w-sm">
              <DigestCard />
            </div>
          </section>

          {/* progress bar */}
          <section>
            <SectionLabel>ProgressBar</SectionLabel>
            <div className="max-w-md">
              <ProgressBar label="Cursor Pro Offset" current={14.72} total={20} />
            </div>
          </section>

          {/* dot grid variants */}
          <section>
            <SectionLabel>DotGrid Variants</SectionLabel>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "16px / 50%", spacing: 16 as const, opacity: 0.5 },
                { label: "24px / 50%", spacing: 24 as const, opacity: 0.5 },
                {
                  label: "16px — heartbeat",
                  spacing: 16 as const,
                  opacity: 0.35,
                  variant: "heartbeat" as const,
                },
              ].map((g) => (
                <div
                  key={g.label}
                  className="h-24 rounded-md border border-[var(--rule-default)] relative overflow-hidden bg-[var(--bg-surface)]"
                >
                  <DotGrid
                    spacing={g.spacing}
                    opacity={g.opacity}
                    variant={g.variant ?? "static"}
                  />
                  <div className="absolute bottom-2 left-2.5 font-data text-[10px] text-[var(--ink-tertiary)]">
                    {g.label}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* footer */}
        <div className="mt-16 pt-4 border-t border-[var(--rule-default)] flex justify-between">
          <span className="font-display text-caption text-[var(--ink-tertiary)]">
            dev drip v0.1
          </span>
          <span className="font-data text-[10px] text-[var(--ink-faint)]">
            Powered by USDC on Base
          </span>
        </div>
      </div>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <h2 className="font-display text-h3 font-bold">{children}</h2>
      <div className="h-px bg-[var(--rule-default)] mt-2" />
    </div>
  );
}
