"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";
import { DotGrid } from "@/components/shared/dot-grid";
import { AgentTerminal } from "@/components/shared/agent-terminal";
import { TerminalTV } from "@/components/shared/terminal-tv";
import { EarningsCounter } from "@/components/shared/earnings-counter";

interface HeroVisualProps {
  className?: string;
}

export function HeroVisual({ className }: HeroVisualProps) {
  return (
    <motion.div
      animate={{ y: [0, -6, 0] }}
      transition={{
        duration: 5,
        repeat: Infinity,
        ease: "easeInOut",
      }}
      className={cn(
        "relative bg-[var(--bg-surface)] border border-[var(--rule-default)] rounded-md overflow-hidden",
        "shadow-md hover:shadow-lg transition-shadow",
        className
      )}
    >
      {/* inner dot texture */}
      <DotGrid opacity={0.12} />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1.2fr_1px_1fr]">
        {/* left panel: agent terminal + terminal tv */}
        <div className="p-5 lg:p-6 space-y-4">
          <AgentTerminal />
          {/* horizontal divider */}
          <div className="h-px bg-[var(--rule-default)]" />
          {/* terminal tv — hidden on mobile, visible on lg+ */}
          <div className="hidden lg:block">
            <TerminalTV rotationIntervalMs={20000} />
          </div>
        </div>

        {/* vertical divider — lg only */}
        <div className="hidden lg:block bg-[var(--rule-default)]" />

        {/* right panel: earnings counter */}
        <div className="p-5 lg:p-6 flex flex-col justify-center border-t lg:border-t-0 border-[var(--rule-default)]">
          <EarningsCounter />
        </div>
      </div>
    </motion.div>
  );
}
