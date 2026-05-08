"use client"

import type { ReactNode } from "react"
import type { ChannelDto } from "@distrotv/shared"
import { cn } from "@distrotv/design-system/utils"

interface ChannelsGridProps {
  channels: ChannelDto[]
  onChange: (next: ChannelDto[]) => void
  disabled?: boolean
}

export function ChannelRow({
  channel,
  onToggle,
  disabled,
  dragHandle,
}: {
  channel: ChannelDto
  onToggle: () => void
  disabled?: boolean
  dragHandle?: ReactNode
}) {
  return (
    <div className={cn("flex items-center gap-3 py-3 px-1", disabled && "opacity-50")}>
      {dragHandle && <span className="flex-shrink-0">{dragHandle}</span>}
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="flex items-center gap-2 flex-1 text-left"
      >
        <span
          className={cn(
            "inline-flex h-4 w-4 items-center justify-center border flex-shrink-0",
            channel.subscribed
              ? "border-[var(--accent-color)] bg-[var(--accent-color)]"
              : "border-[var(--rule-default)]"
          )}
        >
          {channel.subscribed && (
            <svg
              className="h-3 w-3 text-white"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M2 6.5L5 9.5 10 3.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        <span className="font-body text-[13px] text-[var(--ink-primary)]">{channel.label}</span>
      </button>
    </div>
  )
}

export function ChannelsGrid({ channels, onChange, disabled }: ChannelsGridProps) {
  function toggle(key: string) {
    if (disabled) return
    const next = channels.map((c) => (c.key === key ? { ...c, subscribed: !c.subscribed } : c))
    onChange(next)
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {channels.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => toggle(c.key)}
          disabled={disabled}
          className={cn(
            "flex items-center gap-2 rounded-none border px-3 py-2 text-left transition-colors",
            c.subscribed
              ? "border-[var(--accent-color)] bg-[var(--accent-surface)]"
              : "border-[var(--rule-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <span
            className={cn(
              "inline-flex h-4 w-4 items-center justify-center rounded-none border",
              c.subscribed
                ? "border-[var(--accent-color)] bg-[var(--accent-color)]"
                : "border-[var(--rule-default)]"
            )}
          >
            {c.subscribed && (
              <svg
                className="h-3 w-3 text-white"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M2 6.5L5 9.5 10 3.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </span>
          <span className="font-body text-[13px] text-[var(--ink-primary)]">{c.label}</span>
        </button>
      ))}
    </div>
  )
}
