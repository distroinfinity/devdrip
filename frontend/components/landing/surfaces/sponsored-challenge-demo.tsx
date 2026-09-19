"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { terminalColors as tc, tokens } from "@/lib/design-tokens";

const QUESTION = {
  sponsor: "MongoDB Atlas",
  text: "What does this aggregation pipeline return?",
  code: `db.orders.aggregate([
  { $match: { status: "shipped" } },
  { $group: { _id: "$region", total: { $sum: "$amount" } } },
  { $sort: { total: -1 } },
  { $limit: 3 }
])`,
  options: [
    { key: "A", text: "Top 3 regions by shipped order revenue" },
    { key: "B", text: "All shipped orders sorted by amount" },
    { key: "C", text: "Count of shipped orders per region" },
    { key: "D", text: "Average order amount by region" },
  ],
  correctKey: "A",
};

export function SponsoredChallengeDemo() {
  const [selected, setSelected] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSelect = useCallback(
    (key: string) => {
      if (revealed) return;
      setSelected(key);
      setTimeout(() => setRevealed(true), 350);
    },
    [revealed],
  );

  const handleReset = useCallback(() => {
    setSelected(null);
    setRevealed(false);
    containerRef.current?.focus();
  }, []);

  // keyboard shortcuts
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handler = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      if (["A", "B", "C", "D"].includes(key) && !revealed) {
        handleSelect(key);
      }
      if (key === "S") {
        // skip — just reset
        handleReset();
      }
    };
    el.addEventListener("keydown", handler);
    return () => el.removeEventListener("keydown", handler);
  }, [handleSelect, handleReset, revealed]);

  const isCorrect = selected === QUESTION.correctKey;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="max-w-[520px] mx-auto rounded-lg overflow-hidden outline-none focus:ring-1 focus:ring-[var(--accent-color)]"
      style={{ background: tc.bg, border: `1px solid ${tc.border}` }}
    >
      {/* header */}
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: `1px solid ${tc.border}` }}
      >
        <div className="flex items-center gap-2">
          <span style={{ color: tc.text }}>&#x1F3C6;</span>
          <span
            className="font-display text-[12px] font-bold"
            style={{ color: tc.text }}
          >
            Sponsored Challenge
          </span>
        </div>
        <span
          className="font-data text-data-xs font-bold px-2 py-0.5 rounded"
          style={{
            color: "var(--accent-color)",
            background: "var(--accent-glow)",
          }}
        >
          +$0.10 bonus
        </span>
      </div>

      {/* content */}
      <div className="p-4">
        <span
          className="font-body text-[10px] font-semibold uppercase tracking-[0.08em]"
          style={{ color: tc.textTertiary }}
        >
          {QUESTION.sponsor} presents:
        </span>
        <p
          className="font-body text-[14px] font-medium mt-2 mb-3"
          style={{ color: tc.text }}
        >
          {QUESTION.text}
        </p>

        {/* code */}
        <div
          className="rounded p-3 mb-4 font-data text-[11px] leading-relaxed whitespace-pre overflow-x-auto"
          style={{
            background: "#16161A",
            border: `1px solid ${tc.border}`,
            color: tc.textSecondary,
          }}
        >
          {QUESTION.code}
        </div>

        {/* options */}
        <div className="flex flex-col gap-2 mb-4">
          {QUESTION.options.map((opt) => {
            const isSelected = selected === opt.key;
            const isCorrectOption = opt.key === QUESTION.correctKey;

            let borderColor: string = tc.border;
            let bg: string = "transparent";

            if (revealed && isCorrectOption) {
              borderColor = "var(--accent-color)";
              bg = "var(--accent-glow)";
            } else if (revealed && isSelected && !isCorrect) {
              borderColor = "#EF4444";
              bg = "rgba(239,68,68,0.08)";
            } else if (isSelected && !revealed) {
              borderColor = tc.textSecondary;
              bg = "#16161A";
            }

            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => handleSelect(opt.key)}
                disabled={revealed}
                className="flex items-center gap-3 px-3 py-2.5 rounded text-left transition-colors"
                style={{
                  border: `1px solid ${borderColor}`,
                  background: bg,
                }}
              >
                <span
                  className="font-data text-[12px] font-bold w-5 text-center shrink-0"
                  style={{
                    color:
                      revealed && isCorrectOption
                        ? "var(--accent-color)"
                        : tc.textTertiary,
                  }}
                >
                  {opt.key}
                </span>
                <span
                  className="font-body text-[12px]"
                  style={{ color: tc.text }}
                >
                  {opt.text}
                </span>
              </button>
            );
          })}
        </div>

        {/* feedback */}
        <AnimatePresence>
          {revealed && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: tokens.timing.fast / 1000 }}
              className="flex items-center justify-between"
            >
              <span
                className="font-data text-[12px] font-bold"
                style={{
                  color: isCorrect ? "var(--accent-color)" : "#EF4444",
                }}
              >
                {isCorrect
                  ? "Correct! +$0.10"
                  : `The answer was ${QUESTION.correctKey}`}
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="font-data text-[11px] px-2 py-1 rounded"
                style={{
                  border: `1px solid ${tc.border}`,
                  color: tc.textSecondary,
                }}
              >
                Try again
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* footer */}
        {!revealed && (
          <div className="flex items-center justify-between">
            <span
              className="font-data text-[10px]"
              style={{ color: tc.textTertiary }}
            >
              [S]kip challenge
            </span>
            <span
              className="font-data text-[10px]"
              style={{ color: tc.textTertiary }}
            >
              Agent: ~45 sec remaining
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
