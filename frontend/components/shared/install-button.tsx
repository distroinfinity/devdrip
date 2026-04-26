"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"

type InstallState = "idle" | "submitting" | "success"

interface InstallButtonProps {
  onClick?: () => void | Promise<void>
  href?: string
  className?: string
  idleLabel?: string
  submittingLabel?: string
  successLabel?: string
}

export function InstallButton({
  onClick,
  href = "#install",
  className,
  idleLabel = "Install",
  submittingLabel = "...",
  successLabel = "Done.",
}: InstallButtonProps) {
  const [state, setState] = useState<InstallState>("idle")

  if (href) {
    return (
      <a
        href={href}
        className={cn(
          "relative inline-flex items-center justify-center h-11 px-6 rounded-sm font-body text-sm font-medium transition-all overflow-hidden",
          "bg-[var(--ink-primary)] text-[var(--ink-inverse)] hover:bg-[var(--em-hover)]",
          className
        )}
      >
        {idleLabel}
      </a>
    )
  }

  const handleClick = async () => {
    if (state !== "idle") return
    setState("submitting")
    try {
      await onClick?.()
      setState("success")
    } catch {
      setState("idle")
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={state !== "idle"}
      className={cn(
        "relative h-11 px-6 rounded-sm font-body text-sm font-medium transition-all overflow-hidden",
        state === "idle" &&
          "bg-[var(--ink-primary)] text-[var(--ink-inverse)] hover:bg-[var(--em-hover)] cursor-pointer",
        state === "submitting" && "bg-[var(--ink-primary)] text-[var(--ink-inverse)] cursor-wait",
        state === "success" && "bg-[var(--accent-color)] text-white cursor-default",
        className
      )}
      aria-live="polite"
    >
      <AnimatePresence mode="wait">
        {state === "idle" && (
          <motion.span
            key="idle"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
          >
            {idleLabel}
          </motion.span>
        )}
        {state === "submitting" && (
          <motion.span
            key="submitting"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="flex items-center gap-2"
          >
            <span className="h-3 w-3 rounded-full border-2 border-[var(--ink-inverse)] border-t-transparent animate-spin" />
            {submittingLabel}
          </motion.span>
        )}
        {state === "success" && (
          <motion.span
            key="success"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {successLabel}
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}
