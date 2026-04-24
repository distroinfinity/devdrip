"use client"

export type Theme = "light" | "dark"

const STORAGE_KEY = "dd-theme"

export function getTheme(): Theme {
  if (typeof document === "undefined") return "light"
  return (document.documentElement.getAttribute("data-theme") as Theme) ?? "light"
}

export function resolveTheme(): Theme {
  if (typeof window === "undefined") return "light"
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === "light" || stored === "dark") return stored
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function hasExplicitPreference(): boolean {
  if (typeof window === "undefined") return false
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored === "light" || stored === "dark"
  } catch {
    return false
  }
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {}
}

export function toggleTheme(): void {
  setTheme(getTheme() === "light" ? "dark" : "light")
}

// set up theme: resolve initial value + listen for OS changes
// returns cleanup function to remove the listener
export function initTheme(): () => void {
  const theme = resolveTheme()
  document.documentElement.setAttribute("data-theme", theme)

  const mq = window.matchMedia("(prefers-color-scheme: dark)")
  const handler = () => {
    if (!hasExplicitPreference()) {
      const next: Theme = mq.matches ? "dark" : "light"
      document.documentElement.setAttribute("data-theme", next)
    }
  }
  mq.addEventListener("change", handler)

  return () => mq.removeEventListener("change", handler)
}

// inline script string for <head> to avoid FOUC on initial paint.
// runs synchronously before first paint, reads localStorage + media query.
export const themeInitScript = `(function(){var s;try{s=localStorage.getItem("${STORAGE_KEY}")}catch(e){}var t=s==="light"||s==="dark"?s:window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light";document.documentElement.setAttribute("data-theme",t)})()`
