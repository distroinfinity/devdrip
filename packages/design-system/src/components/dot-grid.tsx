"use client"

import { cn } from "../utils"

interface DotGridProps {
  spacing?: 16 | 24
  opacity?: number
  variant?: "static" | "heartbeat"
  className?: string
}

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
        className
      )}
      style={{
        backgroundImage: "radial-gradient(circle, var(--dot-grid-color) 1px, transparent 1px)",
        backgroundSize: `${spacing}px ${spacing}px`,
        opacity,
      }}
    />
  )
}
