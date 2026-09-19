"use client"
import { useState, useRef, useEffect } from "react"

export function InlineHelp({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDocClick)
    return () => document.removeEventListener("mousedown", onDocClick)
  }, [open])

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-label="help"
        className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[10px] font-[var(--font-data)] text-[var(--ink-tertiary)] hover:text-[var(--accent-color)] border border-[var(--rule-default)]"
      >
        ?
      </button>
      {open && (
        <span className="absolute z-50 left-full ml-2 top-0 w-64 p-3 bg-[var(--ink-primary)] text-[var(--bg-primary)] text-[11px] leading-relaxed font-[var(--font-body)]">
          {children}
        </span>
      )}
    </span>
  )
}
