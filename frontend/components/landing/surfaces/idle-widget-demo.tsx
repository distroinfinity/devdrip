"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";

const SPONSOR = {
  name: "Railway",
  description: "Deploy any app in seconds. Zero config.",
  tag: "INFRA",
};

export function IdleWidgetDemo() {
  const [minimized, setMinimized] = useState(false);

  // auto-expand from pill after 3s to keep demo interesting
  useEffect(() => {
    if (!minimized) return;
    const t = setTimeout(() => setMinimized(false), 3000);
    return () => clearTimeout(t);
  }, [minimized]);

  return (
    <div className="flex items-center justify-center min-h-[320px]">
      <AnimatePresence mode="wait">
        {!minimized ? (
          <motion.div
            key="widget"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{
              type: "spring",
              bounce: 0.2,
              duration: 0.5,
            }}
            className="w-full max-w-[360px] rounded-xl overflow-hidden shadow-lg"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--rule-default)",
            }}
          >
            {/* header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: "1px solid var(--rule-default)" }}
            >
              <span className="font-display text-[12px] font-bold text-[var(--ink-primary)]">
                Dev Drip
              </span>
              <span className="font-data text-[16px] font-bold text-[var(--ink-primary)]">
                $14.72
              </span>
            </div>

            {/* sponsor content */}
            <div className="px-4 py-3">
              <div
                className="rounded-md p-3 mb-3"
                style={{
                  background: "var(--bg-inset)",
                  border: "1px solid var(--rule-default)",
                }}
              >
                <div className="flex items-start justify-between mb-1">
                  <div>
                    <span className="font-body text-[8px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-tertiary)]">
                      {SPONSOR.tag}
                    </span>
                    <div className="font-body text-[13px] font-medium text-[var(--ink-primary)] mt-0.5">
                      {SPONSOR.name}
                    </div>
                  </div>
                  <span
                    className="font-data text-data-xs font-bold"
                    style={{ color: "var(--accent-color)" }}
                  >
                    +$0.02
                  </span>
                </div>
                <p className="font-body text-[11px] text-[var(--ink-secondary)]">
                  {SPONSOR.description}
                </p>
              </div>

              {/* agent progress */}
              <div className="mb-3">
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="font-body text-[10px] text-[var(--ink-secondary)]">
                    Editing 3 files...
                  </span>
                  <span className="font-data text-[10px] text-[var(--ink-tertiary)]">
                    62%
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--bg-inset)] rounded-pill overflow-hidden">
                  <motion.div
                    className="h-full rounded-pill"
                    style={{ background: "var(--accent-color)" }}
                    initial={{ width: "30%" }}
                    animate={{ width: "62%" }}
                    transition={{ duration: 2, ease: "easeOut" }}
                  />
                </div>
              </div>

              {/* stats row */}
              <div className="flex gap-4">
                <div>
                  <div className="font-body text-[8px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-tertiary)] mb-0.5">
                    Streak
                  </div>
                  <span className="font-data text-[13px] font-bold text-[var(--ink-primary)]">
                    12 days
                  </span>
                </div>
                <div>
                  <div className="font-body text-[8px] font-semibold uppercase tracking-[0.06em] text-[var(--ink-tertiary)] mb-0.5">
                    This Week
                  </div>
                  <span className="font-data text-[13px] font-bold text-[var(--ink-primary)]">
                    $3.40
                  </span>
                </div>
              </div>
            </div>

            {/* footer */}
            <div
              className="flex items-center justify-between px-4 py-2"
              style={{ borderTop: "1px solid var(--rule-default)" }}
            >
              <button
                type="button"
                onClick={() => setMinimized(true)}
                className="font-data text-[10px] px-2 py-1 rounded transition-colors hover:bg-[var(--bg-inset)]"
                style={{
                  color: "var(--ink-tertiary)",
                  border: "1px solid var(--rule-default)",
                }}
              >
                Minimize
              </button>
              <span className="font-data text-[10px] text-[var(--ink-tertiary)]">
                Settings
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="pill"
            type="button"
            onClick={() => setMinimized(false)}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{
              opacity: 1,
              scale: 1,
              y: [0, -4, 0],
            }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{
              opacity: { duration: 0.2 },
              scale: { type: "spring", bounce: 0.3, duration: 0.4 },
              y: {
                duration: 3,
                repeat: Infinity,
                ease: "easeInOut",
              },
            }}
            className="font-data text-[14px] font-bold px-4 py-2 rounded-pill shadow-md cursor-pointer"
            style={{
              background: "var(--bg-surface)",
              border: "1px solid var(--rule-default)",
              color: "var(--ink-primary)",
            }}
          >
            $14.72
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
