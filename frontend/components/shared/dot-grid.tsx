"use client";

import { cn } from "@/lib/utils";

interface DotGridProps {
  spacing?: 16 | 24;
  opacity?: number;
  variant?: "static" | "heartbeat";
  className?: string;
}

// css radial-gradient approach matching the design system spec
// lighter than MagicUI's SVG dot-pattern for background use
export function DotGrid({
  spacing = 16,
  opacity = 0.5,
  variant = "static",
  className,
}: DotGridProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 pointer-events-none",
        variant === "heartbeat" && "animate-dot-pulse",
        className,
      )}
      style={{
        backgroundImage:
          "radial-gradient(circle, var(--dot-grid-color) 1px, transparent 1px)",
        backgroundSize: `${spacing}px ${spacing}px`,
        opacity,
      }}
    />
  );
}
