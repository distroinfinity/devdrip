"use client"

import { useCallback, useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { BlurFade } from "@/components/ui/blur-fade"
import { EMAIL_RE } from "@/lib/waitlist"

const INSTALL_CMD = "npm i -g @devdrip/cli && devdrip init"

type CopyState = "idle" | "copied"
type FormState = "idle" | "submitting" | "success" | "error"

export function InstallSection() {
  const [copy, setCopy] = useState<CopyState>("idle")
  const [email, setEmail] = useState("")
  const [form, setForm] = useState<FormState>("idle")
  const [hint, setHint] = useState<string | null>(null)

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_CMD)
      setCopy("copied")
      window.setTimeout(() => setCopy("idle"), 1600)
    } catch {
      // older browsers — fall back silently
    }
  }, [])

  const onSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = email.trim()
      if (!EMAIL_RE.test(trimmed)) {
        setForm("error")
        setHint("Enter a valid email.")
        return
      }
      setForm("submitting")
      setHint(null)
      try {
        const res = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: trimmed, source: "install" }),
        })
        const data = (await res.json()) as { success?: boolean; duplicate?: boolean }
        if (!res.ok || !data.success) throw new Error()
        setForm("success")
        setHint(data.duplicate ? "You're already on the list." : "We'll keep you posted.")
      } catch {
        setForm("error")
        setHint("Something went wrong. Try again.")
      }
    },
    [email]
  )

  return (
    <section
      id="install"
      aria-labelledby="install-heading"
      className="relative bg-[var(--bg-primary)] overflow-hidden scroll-mt-20"
    >
      <div className="relative mx-auto max-w-grid px-6 py-24 lg:py-28">
        <div className="flex flex-col items-center text-center gap-8 lg:gap-10">
          {/* eyebrow */}
          <BlurFade inView delay={0}>
            <div className="font-data text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.18em]">
              # install
            </div>
          </BlurFade>

          {/* heading + subtext */}
          <BlurFade inView delay={0.05}>
            <div className="flex flex-col items-center">
              <h2
                id="install-heading"
                className="font-display text-h2 md:text-h1 font-bold text-[var(--ink-primary)] tracking-[-0.02em] mb-4 max-w-[640px]"
              >
                One line to install.
                <br />
                Then keep coding.
              </h2>
              <p className="font-body text-body text-[var(--ink-secondary)] max-w-[520px]">
                Drops the daemon, hooks into Claude Code, and walks you through preferences. About
                30 seconds end to end.
              </p>
            </div>
          </BlurFade>

          {/* terminal-style code block */}
          <BlurFade inView delay={0.15} className="w-full max-w-[720px]">
            <div className="relative group">
              {/* faux titlebar */}
              <div
                className={cn(
                  "flex items-center justify-between h-9 px-4 rounded-t-md",
                  "bg-[#1a1a1d] border border-b-0 border-[#2a2a2f]"
                )}
              >
                <div className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#3a3a3f]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#3a3a3f]" />
                  <span className="h-2.5 w-2.5 rounded-full bg-[#3a3a3f]" />
                </div>
                <span className="font-data text-[10px] tracking-[0.1em] uppercase text-[#6a6a72]">
                  zsh — install
                </span>
                <button
                  type="button"
                  onClick={onCopy}
                  aria-label="Copy install command"
                  className={cn(
                    "font-data text-[10px] tracking-[0.1em] uppercase",
                    "px-2 py-0.5 rounded-sm border transition-colors",
                    copy === "idle"
                      ? "border-[#3a3a3f] text-[#a0a0a8] hover:border-[#5a5a62] hover:text-white"
                      : "border-[var(--accent-color)] text-[var(--accent-color)]"
                  )}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.span
                      key={copy}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="inline-block"
                    >
                      {copy === "idle" ? "copy" : "copied"}
                    </motion.span>
                  </AnimatePresence>
                </button>
              </div>

              {/* command body */}
              <div
                className={cn(
                  "rounded-b-md border border-[#2a2a2f] bg-[#0e0e11]",
                  "px-5 py-6 text-left overflow-x-auto"
                )}
              >
                <code className="font-data text-[15px] md:text-[17px] leading-none whitespace-nowrap">
                  <span className="text-[#5a5a62] select-none">$ </span>
                  <span className="text-[#e8e8ec]">npm i -g </span>
                  <span className="text-[var(--accent-color)]">@devdrip/cli</span>
                  <span className="text-[#5a5a62]"> && </span>
                  <span className="text-[#e8e8ec]">devdrip </span>
                  <span className="text-[#e8e8ec] font-bold">init</span>
                  <span className="ml-1 inline-block h-[1.05em] w-[7px] align-text-bottom bg-[#e8e8ec] animate-pulse" />
                </code>
              </div>
            </div>

            {/* prereq caption */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 font-data text-[10px] tracking-[0.12em] uppercase text-[var(--ink-tertiary)]">
              <span>Node 20+</span>
              <span aria-hidden className="text-[var(--ink-faint)]">
                ·
              </span>
              <span>macOS / Linux</span>
              <span aria-hidden className="text-[var(--ink-faint)]">
                ·
              </span>
              <span>Claude Code</span>
              <span aria-hidden className="text-[var(--ink-faint)]">
                ·
              </span>
              <a
                href="https://nodejs.org"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-2 hover:underline hover:text-[var(--ink-secondary)]"
              >
                need Node?
              </a>
            </div>
          </BlurFade>

          {/* divider + stay-updated form */}
          <BlurFade inView delay={0.3} className="w-full max-w-[480px]">
            <div className="flex items-center gap-3 mb-5">
              <span className="flex-1 h-px bg-[var(--rule-default)]" />
              <span className="font-data text-[9px] tracking-[0.18em] uppercase text-[var(--ink-tertiary)]">
                or
              </span>
              <span className="flex-1 h-px bg-[var(--rule-default)]" />
            </div>

            <form
              onSubmit={onSubmit}
              className="flex flex-col sm:flex-row gap-2 w-full"
              aria-describedby="install-form-hint"
            >
              <label htmlFor="install-email" className="sr-only">
                Email address
              </label>
              <input
                id="install-email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  if (form === "error") {
                    setForm("idle")
                    setHint(null)
                  }
                }}
                placeholder="you@dev.tools"
                disabled={form === "submitting" || form === "success"}
                aria-invalid={form === "error"}
                className={cn(
                  "flex-1 h-11 px-4 rounded-sm",
                  "bg-[var(--bg-surface)] border border-[var(--rule-default)]",
                  "font-body text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-tertiary)]",
                  "focus:outline-none focus:border-[var(--ink-primary)]",
                  form === "error" && "border-[var(--accent-color)]"
                )}
              />
              <button
                type="submit"
                disabled={form === "submitting" || form === "success"}
                className={cn(
                  "h-11 px-5 rounded-sm font-body text-sm font-medium transition-all",
                  form === "success"
                    ? "bg-[var(--accent-color)] text-white cursor-default"
                    : "bg-[var(--ink-primary)] text-[var(--ink-inverse)] hover:bg-[var(--em-hover)] cursor-pointer",
                  form === "submitting" && "cursor-wait opacity-80"
                )}
              >
                {form === "submitting" ? "..." : form === "success" ? "On the list" : "Notify me"}
              </button>
            </form>
            <p
              id="install-form-hint"
              aria-live="polite"
              className={cn(
                "mt-2 min-h-[16px] font-body text-[12px] leading-tight",
                form === "error" ? "text-[var(--accent-color)]" : "text-[var(--ink-tertiary)]"
              )}
            >
              {hint ?? "Get pinged when we open more invites for early public beta."}
            </p>
          </BlurFade>
        </div>
      </div>
    </section>
  )
}
