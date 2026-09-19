"use client";

import { useState, useEffect } from "react";
import { toggleTheme, getTheme, initTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ThemeToggle({ className }: { className?: string }) {
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
      className={cn(
        "font-body text-[13px] font-medium text-[var(--ink-secondary)] hover:bg-[var(--bg-surface-hover)] transition-colors",
        className
          ? className
          : "border border-[var(--rule-default)] rounded-md px-3.5 py-1.5",
      )}
    >
      {theme === "light" ? "Dark" : "Light"}
    </button>
  );
}
