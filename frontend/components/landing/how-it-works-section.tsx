"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "@/lib/utils";
import { terminalColors as tc, tokens } from "@/lib/design-tokens";
import { BlurFade } from "@/components/ui/blur-fade";
import { DotGrid } from "@/components/shared/dot-grid";
import { AgentTerminal } from "@/components/shared/agent-terminal";
import { TerminalTV } from "@/components/shared/terminal-tv";

// -- types & constants --

type DemoPhase = "ready" | "active" | "warming" | "earning" | "vanished";

const STEPS = [
  {
    number: "01",
    label: "YOUR AGENT STARTS WORKING",
    description: "Dev Drip detects idle state and waits 3 seconds.",
    subtext: "Nothing appears during quick completions \u2014 only agentic tasks.",
  },
  {
    number: "02",
    label: "CONTENT APPEARS",
    description:
      "A native-looking panel shows a developer tool recommendation, sponsored tip, or coding challenge.",
  },
  {
    number: "03",
    label: "YOU EARN USD",
    description:
      "$0.01\u2013$0.10 per impression, deposited in real-time. 70% to you. 5% to open-source.",
    subtext: "The moment you start typing, everything vanishes in <200ms.",
  },
];

const STATE_NODES = [
  { label: "ACTIVE", sub: "coding" },
  { label: "WARMING", sub: "3s grace" },
  { label: "IDLE", sub: "earning" },
  { label: "ACTIVE", sub: "typing" },
];

// maps demo phase → which state machine node is active (-1 = none)
const PHASE_TO_NODE: Record<DemoPhase, number> = {
  ready: -1,
  active: 0,
  warming: 1,
  earning: 2,
  vanished: 3,
};

// maps demo phase → which step card highlights (-1 = none)
const PHASE_TO_STEP: Record<DemoPhase, number> = {
  ready: -1,
  active: 0,
  warming: 0,
  earning: 1,
  vanished: 2,
};

// -- hook: demo state machine --

function useDemoStateMachine() {
  const [phase, setPhase] = useState<DemoPhase>("ready");
  const [earningsValue, setEarningsValue] = useState(0);
  const [dismissalMs, setDismissalMs] = useState<number | null>(null);
  const [runCount, setRunCount] = useState(0);
  const dismissStart = useRef(0);

  // active → warming after 2.5s
  useEffect(() => {
    if (phase !== "active") return;
    const t = setTimeout(() => setPhase("warming"), 2500);
    return () => clearTimeout(t);
  }, [phase]);

  // warming → earning after 3s
  useEffect(() => {
    if (phase !== "warming") return;
    const t = setTimeout(() => setPhase("earning"), 3000);
    return () => clearTimeout(t);
  }, [phase]);

  // earnings tick during earning phase, capped at $0.99
  useEffect(() => {
    if (phase !== "earning") return;
    const iv = setInterval(() => {
      setEarningsValue((prev) =>
        Math.min(Math.round((prev + 0.03) * 100) / 100, 0.99)
      );
    }, 1800);
    return () => clearInterval(iv);
  }, [phase]);

  const start = useCallback(() => {
    setEarningsValue(0);
    setDismissalMs(null);
    setPhase("active");
    setRunCount((c) => c + 1);
  }, []);

  const simulateTyping = useCallback(() => {
    if (phase !== "earning") return;
    dismissStart.current = performance.now();
    setPhase("vanished");
  }, [phase]);

  // called by AnimatePresence onExitComplete — measures real animation end
  const measureDismissal = useCallback(() => {
    if (dismissStart.current > 0) {
      setDismissalMs(Math.round(performance.now() - dismissStart.current));
      dismissStart.current = 0;
    }
  }, []);

  const reset = useCallback(() => {
    setEarningsValue(0);
    setDismissalMs(null);
    setPhase("active");
    setRunCount((c) => c + 1);
  }, []);

  return {
    phase,
    earningsValue,
    dismissalMs,
    runCount,
    start,
    simulateTyping,
    measureDismissal,
    reset,
  };
}

// -- sub-components --

function RollingDigit({ digit, index }: { digit: string; index: number }) {
  return (
    <span className="relative inline-block" style={{ width: "0.6em" }}>
      <AnimatePresence mode="popLayout">
        <motion.span
          key={digit}
          className="inline-block"
          initial={{ y: 10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -10, opacity: 0 }}
          transition={{ duration: 0.08, delay: index * 0.03, ease: "easeOut" }}
        >
          {digit}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// minimal counter for the demo stage — no Balance label, no delta badge
function DemoCounter({
  value,
  glowActive,
}: {
  value: number;
  glowActive: boolean;
}) {
  const formatted = `$${value.toFixed(2)}`;
  const digits = formatted.split("");

  return (
    <div className="flex flex-col items-start">
      <div
        className="font-data text-[28px] lg:text-[36px] font-bold leading-none"
        style={{
          color: tc.text,
          transition: "text-shadow 400ms ease",
          textShadow: glowActive
            ? `0 0 24px ${tokens.accent.dark.glow}, 0 0 48px ${tokens.accent.dark.glow}`
            : "none",
        }}
      >
        {digits.map((d, i) =>
          d === "$" || d === "." ? (
            <span key={`s-${i}`} className="inline-block">
              {d}
            </span>
          ) : (
            <RollingDigit key={`p-${i}`} digit={d} index={i} />
          )
        )}
      </div>
      <div
        className="font-data text-[10px] mt-1 tracking-wider"
        style={{ color: tc.textTertiary }}
      >
        USD
      </div>
    </div>
  );
}

function StepCard({
  number,
  label,
  description,
  subtext,
  isActive,
  delay,
}: {
  number: string;
  label: string;
  description: string;
  subtext?: string;
  isActive: boolean;
  delay: number;
}) {
  return (
    <BlurFade inView delay={delay}>
      <div
        className={cn(
          "p-5 rounded-md transition-[border-color,background-color] duration-300 h-full",
          isActive
            ? "border border-[var(--accent-color)] bg-[var(--accent-surface)]"
            : "border border-[var(--rule-default)] bg-[var(--bg-surface)]"
        )}
      >
        <div
          className={cn(
            "font-data text-data-s font-bold mb-2 transition-colors duration-300",
            isActive
              ? "text-[var(--accent-color)]"
              : "text-[var(--ink-tertiary)]"
          )}
        >
          {number}
        </div>
        <div className="font-display text-[11px] font-bold uppercase tracking-[0.06em] text-[var(--ink-primary)] mb-2">
          {label}
        </div>
        <div className="font-body text-body-s text-[var(--ink-secondary)] leading-relaxed">
          {description}
        </div>
        {subtext && (
          <div className="font-body text-caption text-[var(--ink-tertiary)] mt-2">
            {subtext}
          </div>
        )}
      </div>
    </BlurFade>
  );
}

function StateMachineRail({ activeNode }: { activeNode: number }) {
  return (
    <div
      role="status"
      aria-label={`Demo phase: ${activeNode >= 0 ? STATE_NODES[activeNode].label : "ready"}`}
      className="flex flex-col lg:flex-row items-start lg:items-center gap-2 lg:gap-0 px-4 py-3"
      style={{ borderBottom: `1px solid ${tc.border}` }}
    >
      {STATE_NODES.map((node, i) => (
        <div key={`${node.label}-${i}`} className="flex items-center">
          <div className="flex items-center gap-2">
            <motion.span
              className="text-[10px]"
              style={{ color: i === activeNode ? tc.text : tc.textTertiary }}
              animate={
                i === activeNode
                  ? { opacity: [1, 0.4, 1] }
                  : { opacity: 1 }
              }
              transition={
                i === activeNode
                  ? { duration: 1.4, ease: "easeInOut", repeat: Infinity }
                  : {}
              }
            >
              {i === activeNode ? "\u25A0" : "\u25A1"}
            </motion.span>
            <span
              className="font-data text-[11px] font-bold tracking-wide"
              style={{ color: i === activeNode ? tc.text : tc.textTertiary }}
            >
              {node.label}
            </span>
            <span
              className="font-data text-[10px] hidden lg:inline"
              style={{ color: tc.textFaint }}
            >
              ({node.sub})
            </span>
          </div>

          {/* connector line — desktop only, hidden after last node */}
          {i < STATE_NODES.length - 1 && (
            <div
              className="hidden lg:block mx-3 h-px shrink-0"
              style={{ width: 32, background: tc.border }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// -- demo button styles (reusable within the demo panel) --

function DemoButton({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="font-data text-[12px] font-bold px-4 py-1.5 cursor-pointer transition-[border-color] duration-150"
      style={{
        background: "transparent",
        border: `1px solid ${tc.textTertiary}`,
        color: tc.text,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = tc.text)}
      onMouseLeave={(e) =>
        (e.currentTarget.style.borderColor = tc.textTertiary)
      }
    >
      {children}
    </button>
  );
}

// -- main section --

export function HowItWorksSection() {
  const {
    phase,
    earningsValue,
    dismissalMs,
    runCount,
    start,
    simulateTyping,
    measureDismissal,
    reset,
  } = useDemoStateMachine();

  const activeNode = PHASE_TO_NODE[phase];
  const activeStep = PHASE_TO_STEP[phase];

  // any key triggers vanish during earning phase (skip form elements)
  useEffect(() => {
    if (phase !== "earning") return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (e.key.length === 1 || e.key === "Backspace" || e.key === "Enter") {
        simulateTyping();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, simulateTyping]);

  // track glow on earnings tick
  const [glowActive, setGlowActive] = useState(false);
  const prevEarnings = useRef(0);
  useEffect(() => {
    if (earningsValue === 0) {
      prevEarnings.current = 0;
      return;
    }
    if (earningsValue > prevEarnings.current) {
      setGlowActive(true);
      const t = setTimeout(() => setGlowActive(false), 500);
      prevEarnings.current = earningsValue;
      return () => clearTimeout(t);
    }
  }, [earningsValue]);

  // warming bar CSS trigger (needs a frame delay to start transition)
  const [warmingFill, setWarmingFill] = useState(false);
  useEffect(() => {
    if (phase === "warming") {
      const raf = requestAnimationFrame(() => setWarmingFill(true));
      return () => cancelAnimationFrame(raf);
    }
    setWarmingFill(false);
  }, [phase]);

  return (
    <section id="how-it-works" className="relative overflow-hidden scroll-mt-20">
      <DotGrid opacity={0.2} variant="static" />

      <div className="relative mx-auto max-w-grid px-6 py-20">
      {/* section header */}
      <BlurFade inView delay={0}>
        <div className="max-w-content mx-auto text-center mb-12 lg:mb-16">
          <div className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.1em] mb-3">
            HOW IT WORKS
          </div>
          <h2 className="font-display text-h2 md:text-h1 font-bold text-[var(--ink-primary)] mb-3">
            Three steps.{" "}
            <br className="hidden sm:block" />
            One rule.
          </h2>
          <p className="font-body text-body text-[var(--ink-secondary)]">
            Appear on idle. Vanish when you type. You&apos;re always in control.
          </p>
        </div>
      </BlurFade>

      {/* step cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        {STEPS.map((step, i) => (
          <StepCard
            key={step.number}
            number={step.number}
            label={step.label}
            description={step.description}
            subtext={step.subtext}
            isActive={activeStep === i}
            delay={0.1 + i * 0.1}
          />
        ))}
      </div>

      {/* vanish demo */}
      <BlurFade inView delay={0.45}>
        <div
          role="region"
          aria-label="Interactive vanish speed demo"
          className="overflow-hidden rounded-md"
          style={{ background: tc.bg, border: `1px solid ${tc.border}` }}
        >
          {/* title bar */}
          <div
            className="flex items-center px-4 py-2.5"
            style={{ borderBottom: `1px solid ${tc.border}` }}
          >
            <div className="flex items-center gap-2">
              <div className="flex gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: "#FF5F57" }}
                />
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: "#FEBC2E" }}
                />
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ background: "#28C840" }}
                />
              </div>
              <span
                className="font-data text-[11px] font-bold tracking-[0.06em] ml-2"
                style={{ color: tc.textTertiary }}
              >
                DEV DRIP DEMO
              </span>
            </div>
          </div>

          {/* state machine rail */}
          <StateMachineRail activeNode={activeNode} />

          {/* warming progress bar */}
          {phase === "warming" && (
            <div className="h-0.5" style={{ background: tc.border }}>
              <div
                className="h-full"
                style={{
                  width: warmingFill ? "100%" : "0%",
                  background: tokens.accent.dark.DEFAULT,
                  transition: "width 3000ms linear",
                }}
              />
            </div>
          )}

          {/* demo stage */}
          <div className="p-4 lg:p-6">
            {phase === "ready" ? (
              <div className="flex flex-col items-center justify-center py-12 lg:py-16">
                <p
                  className="font-body text-body-s mb-6 text-center"
                  style={{ color: tc.textSecondary }}
                >
                  Watch the idle &rarr; earn &rarr; vanish cycle in action.
                </p>
                <DemoButton onClick={start}>&#9654; Start Demo</DemoButton>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1px_1fr_1px_0.8fr] gap-4 lg:gap-0">
                {/* left: agent terminal — remounts on restart for fresh state */}
                <div className="lg:pr-4">
                  <AgentTerminal key={runCount} />
                </div>

                {/* vertical divider */}
                <div
                  className="hidden lg:block"
                  style={{ background: tc.border }}
                />

                {/* center: terminal tv or placeholder */}
                <div className="lg:px-4 min-h-[160px]">
                  {/* placeholder during active/warming */}
                  {(phase === "active" || phase === "warming") && (
                    <div className="flex items-center justify-center h-full min-h-[160px]">
                      <span
                        className="font-data text-[12px]"
                        style={{ color: tc.textFaint }}
                      >
                        {phase === "active"
                          ? "detecting idle state\u2026"
                          : "grace period\u2026"}
                      </span>
                    </div>
                  )}

                  {/* terminal tv — enters on earning, vanishes on dismiss */}
                  <AnimatePresence onExitComplete={measureDismissal}>
                    {phase === "earning" && (
                      <motion.div
                        key="tv"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          transition: {
                            duration: tokens.timing.vanish / 1000,
                            ease: "easeIn",
                          },
                        }}
                        transition={{
                          duration: tokens.timing.smooth / 1000,
                          ease: tokens.easing.smooth,
                        }}
                      >
                        <TerminalTV />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* vertical divider */}
                <div
                  className="hidden lg:block"
                  style={{ background: tc.border }}
                />

                {/* right: earnings counter or vanish result */}
                <div className="lg:pl-4 flex items-center min-h-[80px]">
                  {/* placeholder $0.00 during active/warming */}
                  {(phase === "active" || phase === "warming") && (
                    <div className="flex flex-col items-start">
                      <span
                        className="font-data text-[28px] lg:text-[36px] font-bold leading-none"
                        style={{ color: tc.textFaint }}
                      >
                        $0.00
                      </span>
                      <span
                        className="font-data text-[10px] mt-1 tracking-wider"
                        style={{ color: tc.textFaint }}
                      >
                        USD
                      </span>
                    </div>
                  )}

                  {/* live counter during earning */}
                  <AnimatePresence>
                    {phase === "earning" && (
                      <motion.div
                        key="counter"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          transition: {
                            duration: tokens.timing.vanish / 1000,
                            ease: "easeIn",
                          },
                        }}
                        transition={{
                          duration: tokens.timing.smooth / 1000,
                          ease: tokens.easing.smooth,
                        }}
                      >
                        <DemoCounter
                          value={earningsValue}
                          glowActive={glowActive}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* vanish result */}
                  <AnimatePresence>
                    {phase === "vanished" && (
                      <motion.div
                        key="vanish-result"
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{
                          duration: 0.2,
                          delay: 0.05,
                          ease: "easeOut",
                        }}
                      >
                        <div
                          className="font-data text-[14px] font-bold"
                          style={{ color: tokens.accent.dark.DEFAULT }}
                        >
                          That was {dismissalMs ?? "\u2026"}ms.
                        </div>
                        <div
                          className="font-body text-[12px] mt-1"
                          style={{ color: tc.textTertiary }}
                        >
                          Back to coding. Zero friction.
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* sr-only live region — always mounted so screen readers catch updates */}
                  <div aria-live="polite" aria-atomic="true" className="sr-only">
                    {phase === "vanished" && dismissalMs !== null
                      ? `Content dismissed in ${dismissalMs} milliseconds`
                      : ""}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* demo controls footer */}
          {phase !== "ready" && (
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderTop: `1px solid ${tc.border}` }}
            >
              {phase === "earning" && (
                <>
                  <DemoButton onClick={simulateTyping}>
                    &#9000; Simulate Typing
                  </DemoButton>
                  <span
                    className="font-data text-[11px]"
                    style={{ color: tc.textFaint }}
                  >
                    or press any key
                  </span>
                </>
              )}

              {phase === "vanished" && (
                <>
                  <DemoButton onClick={reset}>&#8635; Run Again</DemoButton>
                  <span
                    className="font-data text-[11px]"
                    style={{ color: tc.textFaint }}
                  >
                    {dismissalMs !== null && `${dismissalMs}ms dismissal`}
                  </span>
                </>
              )}

              {(phase === "active" || phase === "warming") && (
                <span
                  className="font-data text-[11px]"
                  style={{ color: tc.textFaint }}
                >
                  {phase === "active"
                    ? "agent working\u2026"
                    : "3s grace period\u2026"}
                </span>
              )}
            </div>
          )}
        </div>
      </BlurFade>

      {/* trust details strip */}
      <BlurFade inView delay={0.55}>
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 font-body text-caption text-[var(--ink-tertiary)]">
          <span>Inline completions never trigger content</span>
          <span className="hidden sm:inline text-[var(--rule-default)]">
            &middot;
          </span>
          <span>8-second minimum idle before first impression</span>
          <span className="hidden sm:inline text-[var(--rule-default)]">
            &middot;
          </span>
          <span>
            First 10 minutes of any session are always content-free
          </span>
        </div>
      </BlurFade>
      </div>
    </section>
  );
}
