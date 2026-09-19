"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface EarningsCounterProps {
  initialValue?: number;
  increment?: number;
  intervalMs?: number;
  className?: string;
}

// individual digit that rolls when value changes
function RollingDigit({ digit, index }: { digit: string; index: number }) {
  return (
    <span className="relative inline-block" style={{ width: "0.6em" }}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={digit}
          className="inline-block"
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={{
            duration: 0.08,
            delay: index * 0.04,
            ease: "easeOut",
          }}
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

export function EarningsCounter({
  initialValue = 14.72,
  increment = 0.03,
  intervalMs = 3800,
  className,
}: EarningsCounterProps) {
  const [value, setValue] = useState(initialValue);
  const [showDelta, setShowDelta] = useState(false);
  const [glowActive, setGlowActive] = useState(false);
  const deltaTimeout = useRef<ReturnType<typeof setTimeout>>();
  const glowTimeout = useRef<ReturnType<typeof setTimeout>>();

  const tick = useCallback(() => {
    setValue((prev) => Math.round((prev + increment) * 100) / 100);
    setGlowActive(true);
    setShowDelta(true);

    glowTimeout.current = setTimeout(() => setGlowActive(false), 500);
    deltaTimeout.current = setTimeout(() => setShowDelta(false), 2200);
  }, [increment]);

  useEffect(() => {
    const iv = setInterval(tick, intervalMs);
    return () => {
      clearInterval(iv);
      if (deltaTimeout.current) clearTimeout(deltaTimeout.current);
      if (glowTimeout.current) clearTimeout(glowTimeout.current);
    };
  }, [tick, intervalMs]);

  const formatted = `$${value.toFixed(2)}`;
  const digits = formatted.split("");

  return (
    <div className={cn("relative", className)}>
      {/* balance label */}
      <div className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.08em] mb-1.5">
        Balance
      </div>

      {/* main amount */}
      <div
        className="font-data text-[40px] font-bold text-[var(--ink-primary)] leading-none"
        style={{
          transition: "text-shadow 400ms ease",
          textShadow: glowActive
            ? "0 0 30px var(--em-glow), 0 0 60px var(--em-glow)"
            : "none",
        }}
      >
        {digits.map((d, i) =>
          d === "$" || d === "." ? (
            <span key={`static-${i}`} className="inline-block">
              {d}
            </span>
          ) : (
            <RollingDigit key={`pos-${i}`} digit={d} index={i} />
          ),
        )}
      </div>

      {/* usdc label */}
      <div className="font-data text-[11px] text-[var(--ink-tertiary)] mt-1 tracking-wide">
        USDC
      </div>

      {/* delta badge */}
      <AnimatePresence>
        {showDelta && (
          <motion.div
            className="absolute right-0 top-8 font-data text-[14px] font-bold text-[var(--ink-primary)]"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{
              duration: showDelta ? 0.25 : 0.15,
              ease: showDelta ? "easeOut" : "easeIn",
            }}
          >
            +${increment.toFixed(2)}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
