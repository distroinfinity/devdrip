"use client";

export type Theme = "light" | "dark";

// read current applied theme from DOM
export function getTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return (
    (document.documentElement.getAttribute("data-theme") as Theme) ?? "light"
  );
}

// resolve what theme should be active: localStorage > system preference
export function resolveTheme(): Theme {
  if (typeof window === "undefined") return "light";
  try {
    const stored = localStorage.getItem("dd-theme");
    if (stored === "light" || stored === "dark") return stored;
  } catch {}
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// true if user has explicitly toggled (localStorage has a value)
export function hasExplicitPreference(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = localStorage.getItem("dd-theme");
    return stored === "light" || stored === "dark";
  } catch {
    return false;
  }
}

// apply theme to DOM + persist to localStorage (explicit user action)
export function setTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
  try {
    localStorage.setItem("dd-theme", theme);
  } catch {}
}

// toggle between light/dark (explicit user action, persists)
export function toggleTheme() {
  setTheme(getTheme() === "light" ? "dark" : "light");
}

// set up theme: resolve initial value + listen for OS changes
// returns cleanup function to remove the listener
export function initTheme(): () => void {
  const theme = resolveTheme();
  document.documentElement.setAttribute("data-theme", theme);

  // follow OS changes when user hasn't explicitly chosen
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    if (!hasExplicitPreference()) {
      const next: Theme = mq.matches ? "dark" : "light";
      document.documentElement.setAttribute("data-theme", next);
    }
  };
  mq.addEventListener("change", handler);

  return () => mq.removeEventListener("change", handler);
}
