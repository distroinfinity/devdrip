"use client"

import { useState, useEffect } from "react"
import { toggleTheme, getTheme, initTheme } from "../theme"
import { cn } from "../utils"

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setThemeState] = useState<"light" | "dark">("light")

  useEffect(() => {
    const cleanup = initTheme()
    setThemeState(getTheme())

    const observer = new MutationObserver(() => setThemeState(getTheme()))
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    })

    return () => {
      cleanup()
      observer.disconnect()
    }
  }, [])

  return (
    <button
      onClick={() => {
        toggleTheme()
        setThemeState(getTheme())
      }}
      className={cn(
        "font-body text-[13px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors",
        className ? className : "border border-[var(--rule-default)] rounded-md px-3.5 py-1.5"
      )}
    >
      {theme === "light" ? "Dark" : "Light"}
    </button>
  )
}
