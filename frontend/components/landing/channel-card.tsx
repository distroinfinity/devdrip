import { cn } from "@/lib/utils"
import { TerminalTV, type ChannelBlock } from "./terminal-tv"

interface ChannelCardProps {
  channelId: string // "CH 01"
  channelName: string // "NEWS"
  title: string // "The signal, not the timeline."
  blurb: string
  sources: string[]
  features: string[]
  preview: ChannelBlock
  previewFooterKeys: string
  className?: string
}

export function ChannelCard({
  channelId,
  channelName,
  title,
  blurb,
  sources,
  features,
  preview,
  previewFooterKeys,
  className,
}: ChannelCardProps) {
  return (
    <div
      className={cn(
        "bg-[var(--bg-surface)] border border-[var(--rule-default)] flex flex-col",
        className
      )}
    >
      {/* head zone */}
      <div className="p-5 md:p-6 border-b border-[var(--rule-default)]">
        <div className="font-data text-[11px] tracking-[0.08em] text-[var(--accent-color)] mb-2">
          {channelId} · {channelName}
        </div>
        <h3
          className="font-display text-[22px] leading-tight tracking-[-0.02em] text-[var(--ink-primary)] mb-2"
          style={{ fontWeight: 400 }}
        >
          {title}
        </h3>
        <p className="font-body text-[13px] leading-[1.5] text-[var(--ink-secondary)] mb-3.5 max-w-[38ch]">
          {blurb}
        </p>

        {/* sources */}
        <div className="flex gap-1.5 flex-wrap mb-3.5">
          {sources.map((s) => (
            <span
              key={s}
              className="font-data text-[10px] tracking-[0.02em] px-1.5 py-0.5 border border-[var(--rule-default)] bg-[var(--bg-primary)] text-[var(--ink-secondary)]"
            >
              {s}
            </span>
          ))}
        </div>

        {/* features */}
        <div className="pt-3 border-t border-dashed border-[var(--rule-default)] flex gap-4 flex-wrap font-data text-[10px] tracking-[0.03em] text-[var(--ink-secondary)]">
          {features.map((f) => (
            <span key={f}>
              <span className="text-[var(--ink-tertiary)]">› </span>
              {f}
            </span>
          ))}
        </div>
      </div>

      {/* dark preview zone */}
      <TerminalTV
        variant="preview"
        pathLabel=""
        statusLabel=""
        blocks={[preview]}
        footerKeys={previewFooterKeys}
        footerRight=""
        className="border-t-0"
      />
    </div>
  )
}
