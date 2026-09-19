"use client";

import { useState, useEffect } from "react";
import { toggleTheme, getTheme, initTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setThemeState] = useState<"light" | "dark">("light");

  useEffect(() => {
    initTheme();
    setThemeState(getTheme());
  }, []);

  return (
    <button
      onClick={() => {
        toggleTheme();
        setThemeState(getTheme());
      }}
      className="font-body text-[13px] font-medium text-[var(--ink-secondary)] border border-[var(--rule-default)] rounded-md px-3.5 py-1.5 hover:bg-[var(--bg-surface-hover)] transition-colors"
    >
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}
