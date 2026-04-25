"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { BlurFade } from "@/components/ui/blur-fade";
import { DotGrid } from "@/components/shared/dot-grid";
import { PlaceholdersAndVanishInput } from "@/components/ui/placeholders-and-vanish-input";
import { cn } from "@/lib/utils";
import { AI_TOOLS, MONTHLY_SPEND_OPTIONS, submitWaitlist } from "@/lib/waitlist";
import type { AiTool, MonthlySpend, WaitlistResponse } from "@/lib/waitlist";

const EMAIL_PLACEHOLDERS = [
  "your@email.com",
  "developer@startup.io",
  "coder@bangalore.dev",
  "hacker@localhost",
];

const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

// smooth easing used across sections
const EASE_SMOOTH = [0.16, 1, 0.3, 1] as const;

type Step =
  | "email"        // step 1: just the email input
  | "transitioning" // vanish animation playing, input still mounted
  | "questions"     // step 2: ICP fields + submit
  | "submitting"    // API call in flight
  | "success"       // done
  | "error";        // API error, auto-recovers to questions

export function WaitlistSection() {
  const [email, setEmail] = useState("");
  // tools selected at the top level (e.g. "claude", "cursor")
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  // sub-options selected (e.g. "claude:terminal", "github-copilot:vscode")
  const [selectedSubOptions, setSelectedSubOptions] = useState<string[]>([]);
  const [monthlySpend, setMonthlySpend] = useState<MonthlySpend>("");
  const [honey, setHoney] = useState("");
  const [step, setStep] = useState<Step>("email");
  const [result, setResult] = useState<WaitlistResponse | null>(null);
  const [validationError, setValidationError] = useState("");
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const toggleTool = (tool: AiTool) => {
    const isSelected = selectedTools.includes(tool.value);

    if (isSelected) {
      // deselect tool + clear its sub-options
      setSelectedTools((prev) => prev.filter((t) => t !== tool.value));
      if (tool.subOptions) {
        const subValues = tool.subOptions.map((s) => s.value);
        setSelectedSubOptions((prev) =>
          prev.filter((s) => !subValues.includes(s)),
        );
      }
    } else {
      setSelectedTools((prev) => [...prev, tool.value]);
    }
  };

  const toggleSubOption = (subValue: string) => {
    setSelectedSubOptions((prev) =>
      prev.includes(subValue)
        ? prev.filter((s) => s !== subValue)
        : [...prev, subValue],
    );
  };

  // build final ai_tools array for the API:
  // tools without sub-options → just the value ("cursor")
  // tools with sub-options → only send selected sub-values ("claude:terminal")
  // if a tool with sub-options is selected but no sub-option chosen → send parent value
  const buildAiToolsPayload = (): string[] => {
    const result: string[] = [];
    for (const toolValue of selectedTools) {
      const tool = AI_TOOLS.find((t) => t.value === toolValue);
      if (!tool) continue;

      if (!tool.subOptions) {
        result.push(tool.value);
      } else {
        const selected = tool.subOptions.filter((s) =>
          selectedSubOptions.includes(s.value),
        );
        if (selected.length > 0) {
          result.push(...selected.map((s) => s.value));
        } else {
          // selected parent but no sub-option — store parent
          result.push(tool.value);
        }
      }
    }
    return result;
  };

  // tools that have sub-options and are currently selected
  const toolsWithVisibleSubs = AI_TOOLS.filter(
    (t) => t.subOptions && selectedTools.includes(t.value),
  );

  // step 1: capture email, let vanish animation play, then reveal step 2
  const handleEmailSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setValidationError("");

    if (!isValidEmail(email)) {
      setValidationError("Enter a valid email address.");
      return;
    }

    setStep("transitioning");
    // wait for vanish particle animation to finish (~500-700ms)
    timerRef.current = setTimeout(() => setStep("questions"), 700);
  };

  // step 2: send everything to the API
  const handleFinalSubmit = async () => {
    setStep("submitting");
    setValidationError("");

    try {
      const res = await submitWaitlist({
        email,
        aiTools: buildAiToolsPayload(),
        monthlySpend,
        source: "bottom",
        _honey: honey,
      });

      setResult(res);

      if (res.success) {
        setStep("success");
      } else {
        setValidationError(res.message);
        setStep("error");
        timerRef.current = setTimeout(() => setStep("questions"), 3000);
      }
    } catch {
      setValidationError("Something went wrong. Try again.");
      setStep("error");
      timerRef.current = setTimeout(() => setStep("questions"), 3000);
    }
  };

  const handleEditEmail = () => {
    setStep("email");
    setValidationError("");
  };

  return (
    <section
      id="waitlist"
      aria-labelledby="waitlist-heading"
      className="relative bg-[var(--bg-secondary)] overflow-hidden scroll-mt-20"
    >
      <DotGrid opacity={0.18} variant="heartbeat" />

      <div className="relative mx-auto max-w-grid px-6 py-20">
        <div className="flex flex-col items-center text-center gap-6">
          <BlurFade inView delay={0}>
            <div className="flex flex-col items-center">
              <div className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.1em] mb-3">
                Beta Access
              </div>
              <h2
                id="waitlist-heading"
                className="font-display text-h2 md:text-h1 font-bold text-[var(--ink-primary)] tracking-[-0.02em] mb-4"
              >
                Dev Drip is in active development.
              </h2>
              <p className="font-body text-body text-[var(--ink-secondary)] max-w-[520px]">
                The idle engine works. Terminal TV renders. The payment rail is
                integrated. We&rsquo;re onboarding developers in waves.
              </p>
            </div>
          </BlurFade>

          {/* honeypot — always mounted, invisible */}
          <input
            type="text"
            name="_honey"
            value={honey}
            onChange={(e) => setHoney(e.target.value)}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            style={{
              position: "absolute",
              left: "-9999px",
              opacity: 0,
              height: 0,
              width: 0,
            }}
          />

          <BlurFade inView delay={0.1} className="w-full max-w-xl">
            <AnimatePresence mode="wait">
              {/* ── step 1: email input ── */}
              {(step === "email" || step === "transitioning") && (
                <motion.div
                  key="step-email"
                  initial={{ opacity: 1, y: 0 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                  transition={{ duration: 0.25, ease: EASE_SMOOTH }}
                >
                  <div
                    className={
                      step === "transitioning" ? "pointer-events-none" : ""
                    }
                  >
                    <PlaceholdersAndVanishInput
                      placeholders={EMAIL_PLACEHOLDERS}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (validationError) setValidationError("");
                      }}
                      onSubmit={handleEmailSubmit}
                    />
                  </div>

                  {validationError && step === "email" && (
                    <p className="font-body text-[13px] text-[var(--status-negative)] mt-2 text-center">
                      {validationError}
                    </p>
                  )}
                </motion.div>
              )}

              {/* ── step 2: ICP questions ── */}
              {(step === "questions" || step === "submitting" || step === "error") && (
                <motion.div
                  key="step-questions"
                  initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
                  transition={{ duration: 0.35, ease: EASE_SMOOTH }}
                  className="flex flex-col items-center gap-5"
                >
                  {/* email confirmation */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, ease: EASE_SMOOTH }}
                    className="flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4 text-[var(--accent-color)] shrink-0"
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" />
                    </svg>
                    <span className="font-data text-[14px] text-[var(--ink-secondary)]">
                      {email}
                    </span>
                    <span className="text-[var(--ink-faint)]">&middot;</span>
                    <button
                      type="button"
                      onClick={handleEditEmail}
                      className="font-body text-[12px] text-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)] underline underline-offset-2 transition-colors duration-150"
                    >
                      edit
                    </button>
                  </motion.div>

                  {/* ai tools multi-select with sub-options */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.08, duration: 0.3, ease: EASE_SMOOTH }}
                    className="w-full"
                  >
                    <p className="font-body text-[12px] font-medium text-[var(--ink-tertiary)] mb-2.5 text-center">
                      Which AI coding tools do you use?
                    </p>

                    {/* main tool pills */}
                    <div className="flex flex-wrap justify-center gap-2">
                      {AI_TOOLS.map((tool) => {
                        const active = selectedTools.includes(tool.value);
                        return (
                          <button
                            key={tool.value}
                            type="button"
                            onClick={() => toggleTool(tool)}
                            className={cn(
                              "px-3 py-1.5 rounded-full text-[13px] font-medium font-body border transition-all duration-150",
                              active
                                ? "bg-[var(--ink-primary)] text-[var(--ink-inverse)] border-[var(--ink-primary)]"
                                : "bg-transparent text-[var(--ink-tertiary)] border-[var(--rule-default)] hover:border-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]",
                            )}
                          >
                            {tool.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* sub-option pills — slide in below selected tools */}
                    <AnimatePresence>
                      {toolsWithVisibleSubs.map((tool) => (
                        <motion.div
                          key={`sub-${tool.value}`}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2, ease: EASE_SMOOTH }}
                          className="overflow-hidden"
                        >
                          <div className="flex flex-wrap justify-center gap-1.5 pt-2 pl-4">
                            <span className="text-[11px] font-body text-[var(--ink-faint)] self-center mr-1">
                              {tool.label}:
                            </span>
                            {tool.subOptions!.map((sub) => {
                              const subActive = selectedSubOptions.includes(sub.value);
                              return (
                                <button
                                  key={sub.value}
                                  type="button"
                                  onClick={() => toggleSubOption(sub.value)}
                                  className={cn(
                                    "px-2.5 py-1 rounded-full text-[11px] font-medium font-body border transition-all duration-150",
                                    subActive
                                      ? "bg-[var(--ink-secondary)] text-[var(--ink-inverse)] border-[var(--ink-secondary)]"
                                      : "bg-transparent text-[var(--ink-faint)] border-[var(--rule-subtle)] hover:border-[var(--ink-faint)] hover:text-[var(--ink-tertiary)]",
                                  )}
                                >
                                  {sub.label}
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </motion.div>

                  {/* monthly spend — single-select pills */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.16, duration: 0.3, ease: EASE_SMOOTH }}
                  >
                    <p className="font-body text-[12px] font-medium text-[var(--ink-tertiary)] mb-2.5 text-center">
                      Monthly AI tool spend?
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {MONTHLY_SPEND_OPTIONS.map((opt) => {
                        const active = monthlySpend === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              setMonthlySpend(active ? "" : opt.value)
                            }
                            className={cn(
                              "px-3 py-1.5 rounded-full text-[13px] font-medium font-data border transition-all duration-150 tabular-nums",
                              active
                                ? "bg-[var(--ink-primary)] text-[var(--ink-inverse)] border-[var(--ink-primary)]"
                                : "bg-transparent text-[var(--ink-tertiary)] border-[var(--rule-default)] hover:border-[var(--ink-tertiary)] hover:text-[var(--ink-secondary)]",
                            )}
                          >
                            {opt.label}/mo
                          </button>
                        );
                      })}
                    </div>
                  </motion.div>

                  {/* submit button + helper */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.24, duration: 0.3, ease: EASE_SMOOTH }}
                    className="flex flex-col items-center gap-2 pt-1"
                  >
                    <button
                      type="button"
                      onClick={handleFinalSubmit}
                      disabled={step === "submitting"}
                      className={cn(
                        "h-11 px-8 rounded-sm font-body text-sm font-medium transition-all",
                        step === "submitting"
                          ? "bg-[var(--ink-primary)] text-[var(--ink-inverse)] cursor-wait opacity-70"
                          : "bg-[var(--ink-primary)] text-[var(--ink-inverse)] hover:bg-[var(--em-hover)] cursor-pointer",
                      )}
                    >
                      {step === "submitting" ? (
                        <span className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full border-2 border-[var(--ink-inverse)] border-t-transparent animate-spin" />
                          Requesting...
                        </span>
                      ) : (
                        "Request Access"
                      )}
                    </button>
                    <p className="font-body text-[11px] text-[var(--ink-faint)]">
                      All optional — skip straight to submit.
                    </p>

                    {validationError && (step === "error" || step === "questions") && (
                      <p className="font-body text-[13px] text-[var(--status-negative)] mt-1">
                        {validationError}
                      </p>
                    )}
                  </motion.div>
                </motion.div>
              )}

              {/* ── step 3: success ── */}
              {step === "success" && result && (
                <motion.div
                  key="step-success"
                  initial={{ opacity: 0, y: 16, filter: "blur(6px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ duration: 0.35, ease: EASE_SMOOTH }}
                  className="flex flex-col items-center gap-2 py-4"
                >
                  <span className="font-display text-[20px] font-bold text-[var(--ink-primary)]">
                    {result.duplicate
                      ? "You\u2019ve already requested access."
                      : "Request received."}
                  </span>
                  {result.position && (
                    <span className="font-data text-[18px] font-bold text-[var(--ink-primary)] tabular-nums">
                      You&rsquo;re #{result.position} in line.
                    </span>
                  )}
                  <span className="font-body text-[13px] text-[var(--ink-tertiary)]">
                    We&rsquo;ll reach out when your wave opens.
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </BlurFade>
        </div>
      </div>
    </section>
  );
}

