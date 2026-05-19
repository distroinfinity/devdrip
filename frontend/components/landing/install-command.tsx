"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

export const INSTALL_COMMAND = "curl -fsSL https://distrotv.xyz/install.sh | sh"

type Variant = "pill" | "hero" | "large"

interface InstallCommandProps {
  variant?: Variant
  className?: string
}

export function InstallCommand({ variant = "hero", className }: InstallCommandProps) {
  const [copied, setCopied] = useState(false)

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND)
      setCopied(true)
      setTimeout(() => setCopied(false), 1200)
    } catch {
      // clipboard blocked (e.g. http on non-localhost) — fall through silently
    }
  }

  if (variant === "pill") {
    return (
      <button
        onClick={onCopy}
        className={cn(
          "font-data text-[11px] tracking-tight",
          "bg-[var(--ink-primary)] text-[var(--bg-primary)]",
          "px-3 py-1.5 inline-flex items-center gap-2",
          "hover:bg-[var(--em-hover)] transition-colors",
          className
        )}
        aria-label="copy install command"
      >
        <span className="text-[var(--ink-tertiary)]">$</span>
        <span className="truncate max-w-[180px]">curl -fsSL distrotv.xyz/install.sh | sh</span>
        <CopyIcon copied={copied} />
      </button>
    )
  }

  if (variant === "hero") {
    return (
      <button
        onClick={onCopy}
        className={cn(
          "font-data text-[12px]",
          "bg-[var(--ink-primary)] text-[var(--bg-primary)]",
          "px-4 py-2.5 inline-flex items-center gap-3",
          "hover:bg-[var(--em-hover)] transition-colors",
          className
        )}
        aria-label="copy install command"
      >
        <span className="text-[var(--ink-tertiary)]">$</span>
        <span>{INSTALL_COMMAND}</span>
        <CopyIcon copied={copied} />
      </button>
    )
  }

  // large variant — used by install-section
  return (
    <div
      className={cn(
        "relative w-full",
        "bg-[var(--ink-primary)] text-[var(--bg-primary)]",
        "px-6 py-5",
        "font-data text-[14px]",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <span className="text-[var(--ink-tertiary)]">$</span>
        <span className="truncate">{INSTALL_COMMAND}</span>
      </div>
      <button
        onClick={onCopy}
        className="absolute top-4 right-4 p-1.5 hover:bg-[var(--em-hover)] transition-colors"
        aria-label="copy install command"
      >
        <CopyIcon copied={copied} />
      </button>
    </div>
  )
}

function CopyIcon({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <span className="font-data text-[10px] text-[var(--accent-color)] tracking-wider">
        COPIED
      </span>
    )
  }
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <rect x="9" y="9" width="13" height="13" rx="0" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}
