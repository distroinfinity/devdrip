"use client";

import { BlurFade } from "@/components/ui/blur-fade";
import { DotGrid } from "@/components/shared/dot-grid";
import { AgentTerminal } from "@/components/shared/agent-terminal";
import { DataStrip } from "@/components/shared/data-strip";

const DATA_POINTS = [
  { label: "daily idle time", value: "15–60 min" },
  { label: "devs use AI tools", value: "85%" },
  { label: "per agentic task", value: "30s+" },
  { label: "as agents improve", value: "↑ YoY" },
];

export function DeadTimeSection() {
  return (
    <section
      id="dead-time"
      aria-labelledby="dead-time-heading"
      className="relative bg-[var(--bg-secondary)] overflow-hidden scroll-mt-20"
    >
      <DotGrid opacity={0.18} variant="heartbeat" />

      <div className="relative mx-auto max-w-grid px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_0.8fr] gap-12 lg:gap-16 items-center">
          {/* left — copy + data */}
          <div>
            <BlurFade inView delay={0}>
              <div className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.1em] mb-3">
                The Problem
              </div>
              <h2 id="dead-time-heading" className="font-display text-h2 md:text-h1 font-bold text-[var(--ink-primary)] mb-6">
                The Dead Time
              </h2>
            </BlurFade>

            <BlurFade inView delay={0.1}>
              <div className="max-w-content space-y-4 mb-10">
                <p className="font-body text-body text-[var(--ink-secondary)]">
                  Your agent is refactoring 4 files. The spinner is spinning.
                  You can&apos;t code — the agent is in the files. You can&apos;t
                  leave — it might need input in 30 seconds. So you check Slack.
                  Scroll Twitter. Stare at the terminal.
                </p>
                <p className="font-body text-body text-[var(--ink-secondary)]">
                  That&apos;s 15 to 60 minutes every day.{" "}
                  <span className="font-semibold text-[var(--ink-primary)]">
                    Dead time.
                  </span>
                </p>
                <p className="font-body text-body text-[var(--ink-primary)]">
                  Dev Drip fills it with something that actually pays you.
                </p>
              </div>
            </BlurFade>

            <BlurFade inView delay={0.2}>
              <DataStrip data={DATA_POINTS} separator="rule" />
            </BlurFade>
          </div>

          {/* right — terminal demo */}
          <BlurFade inView delay={0.3}>
            <AgentTerminal />
          </BlurFade>
        </div>
      </div>
    </section>
  );
}
