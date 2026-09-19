import { cn } from "@/lib/utils"

export interface NewsItem {
  source: string
  headline: string
  meta: string // e.g. "12m ago" or "HN · 412 pts"
}

export interface TickerItem {
  symbol: string
  price: string
  delta: string // e.g. "+2.14%" or "-1.22%"
  direction: "up" | "down"
  sparkline: string // unicode block chars e.g. "▁▂▃▅▇█▇"
}

export type ChannelBlock =
  | { kind: "news"; id: string; title: string; status: string; items: NewsItem[] }
  | { kind: "markets"; id: string; title: string; status: string; rows: TickerItem[] }
  | {
      kind: "sponsored"
      id: string
      advertiser: string
      copy: string
      url: string
      est: string
      today?: string
    }

interface TerminalTVProps {
  pathLabel?: string
  statusLabel?: string
  blocks: ChannelBlock[]
  footerKeys?: string
  footerRight?: string
  className?: string
  variant?: "card" | "preview" // card = light frame; preview = dark inner block for channel-card
}

export function TerminalTV({
  pathLabel = "~ · distro tv · ambient",
  statusLabel = "● broadcasting",
  blocks,
  footerKeys = "dtv open   ·   dtv mute   ·   dtv preferences",
  footerRight = "~/.distro/config.json",
  className,
  variant = "card",
}: TerminalTVProps) {
  const isPreview = variant === "preview"

  return (
    <div
      className={cn(
        "font-data text-[11px] leading-[1.5] flex flex-col",
        isPreview
          ? "bg-[#0A0A0C] text-[#EDEDF0]"
          : "bg-[var(--bg-surface)] text-[var(--ink-primary)] border border-[var(--rule-default)] shadow-[0_8px_24px_rgba(14,14,17,0.04)]",
        className
      )}
    >
      {/* frame head */}
      <div
        className={cn(
          "flex items-center gap-1.5 px-3 py-2 text-[10px] tracking-wider",
          isPreview
            ? "text-[#5C5C66] border-b border-[#1E1E22] bg-[#0A0A0C]"
            : "text-[var(--ink-tertiary)] border-b border-[var(--rule-default)] bg-[var(--bg-primary)]"
        )}
      >
        <span className="w-2 h-2 rounded-full border border-[var(--rule-strong)]" />
        <span className="w-2 h-2 rounded-full border border-[var(--rule-strong)]" />
        <span className="w-2 h-2 rounded-full border border-[var(--rule-strong)]" />
        <span className="ml-2 text-[10px]">{pathLabel}</span>
        <span className="ml-auto text-[10px]">{statusLabel}</span>
      </div>

      {/* blocks */}
      {blocks.map((block, idx) => (
        <div
          key={block.id}
          className={cn(
            "px-4 py-3",
            idx < blocks.length - 1 &&
              (isPreview ? "border-b border-[#1E1E22]" : "border-b border-[var(--rule-subtle)]")
          )}
        >
          {block.kind === "sponsored" && <SponsoredBlock block={block} isPreview={isPreview} />}

          {/* block head */}
          {block.kind !== "sponsored" && (
            <div
              className={cn(
                "flex justify-between items-center mb-2 text-[10px] tracking-wider",
                isPreview ? "text-[#8A8A94]" : "text-[var(--ink-secondary)]"
              )}
            >
              <span
                className={cn(
                  "font-bold",
                  isPreview ? "text-[#EDEDF0]" : "text-[var(--ink-primary)]"
                )}
              >
                <span className="inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle bg-[var(--accent-color)]" />
                {block.title}
              </span>
              <span className={isPreview ? "text-[#5C5C66]" : "text-[var(--ink-tertiary)]"}>
                {block.status}
              </span>
            </div>
          )}

          {block.kind === "news" &&
            (isPreview ? (
              /* editorial brief: accent kicker, lead headline emphasized, ruled stories */
              <div className="divide-y divide-[#1E1E22]">
                {block.items.map((item, i) => (
                  <div key={i} className="py-2 first:pt-0 last:pb-0">
                    <div className="mb-1 text-[9px] uppercase tracking-[0.14em] text-[var(--accent-color)]">
                      {item.source}
                    </div>
                    <div
                      className={cn(
                        "font-bold leading-snug text-[#EDEDF0]",
                        i === 0 ? "text-[14px]" : "text-[12px]"
                      )}
                    >
                      {item.headline}
                    </div>
                    <div className="mt-1 text-[9px] tracking-wider text-[#5C5C66]">{item.meta}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {block.items.map((item, i) => (
                  <div key={i} className="grid grid-cols-[auto_1fr] gap-3 items-start">
                    <span className="min-w-[80px] pt-0.5 text-[10px] uppercase tracking-wider text-[var(--accent-color)]">
                      {item.source}
                    </span>
                    <span className="text-[12px] font-bold leading-snug text-[var(--ink-primary)]">
                      {item.headline}
                      <span className="mt-0.5 block text-[9px] font-normal tracking-wider text-[var(--ink-tertiary)]">
                        {item.meta}
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            ))}

          {block.kind === "markets" && (
            <div className="space-y-0.5">
              {isPreview && (
                <div className="grid grid-cols-[50px_70px_60px_1fr] gap-3 border-b border-[#1E1E22] pb-1 mb-1 text-[9px] uppercase tracking-[0.14em] text-[#5C5C66]">
                  <span>sym</span>
                  <span className="text-right">last</span>
                  <span className="text-right">chg</span>
                  <span className="text-right">7d</span>
                </div>
              )}
              {block.rows.map((row, i) => (
                <div
                  key={i}
                  className={cn(
                    "grid grid-cols-[50px_70px_60px_1fr] gap-3 items-center text-[11px] py-0.5",
                    i === block.rows.length - 1 && "last-row-flash" // CSS class for ticker tick (defined in globals.css)
                  )}
                >
                  <span
                    className={cn(
                      "font-bold",
                      isPreview ? "text-[#EDEDF0]" : "text-[var(--ink-primary)]"
                    )}
                  >
                    {row.symbol}
                  </span>
                  <span
                    className={cn(
                      "text-right",
                      isPreview ? "text-[#8A8A94]" : "text-[var(--ink-secondary)]"
                    )}
                  >
                    {row.price}
                  </span>
                  <span
                    className={cn(
                      "text-right font-bold",
                      row.direction === "down"
                        ? "text-[var(--status-negative)]"
                        : isPreview
                          ? "text-[#EDEDF0]"
                          : "text-[var(--ink-primary)]"
                    )}
                  >
                    {row.delta}
                  </span>
                  <span
                    className={cn(
                      "tracking-tighter text-right text-[11px]",
                      isPreview ? "text-[#8A8A94]" : "text-[var(--ink-secondary)]"
                    )}
                  >
                    {row.sparkline}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}

      {/* frame foot */}
      <div
        className={cn(
          "mt-auto flex flex-wrap justify-between gap-x-4 gap-y-0.5 px-3 py-1.5 text-[10px]",
          isPreview
            ? "border-t border-[#1E1E22] text-[#5C5C66]"
            : "border-t border-[var(--rule-default)] text-[var(--ink-tertiary)]"
        )}
      >
        <span className="whitespace-pre-wrap">{footerKeys}</span>
        <span>{footerRight}</span>
      </div>
    </div>
  )
}

// mirrors the cli sponsored panel: three rows, each led by the bar
//   ▍ AD  advertiser                  +$0.0070
//   ▍ copy
//   ▍ ↗ click url  ⌘ click   est. today $0.0770
function SponsoredBlock({
  block,
  isPreview,
}: {
  block: Extract<ChannelBlock, { kind: "sponsored" }>
  isPreview: boolean
}) {
  const muted = isPreview ? "text-[#5C5C66]" : "text-[var(--ink-tertiary)]"
  const fg = isPreview ? "text-[#EDEDF0]" : "text-[var(--ink-primary)]"
  return (
    <div className="border-l-2 border-[var(--accent-color)] pl-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2">
          <span className="shrink-0 bg-[var(--accent-color)] px-1 text-[9px] font-bold leading-[1.5] text-white">
            AD
          </span>
          <span className={cn("truncate text-[12px] font-bold", fg)}>{block.advertiser}</span>
        </span>
        <span className="shrink-0 text-[11px] text-[var(--status-positive)]">{block.est}</span>
      </div>
      <div className={cn("mt-1 text-[12px] leading-snug", fg)}>{block.copy}</div>
      <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 text-[10px]">
        <span className="min-w-0 break-all text-[var(--accent-color)]">
          ↗ {block.url}
          <span className={cn("ml-2 whitespace-nowrap", muted)}>⌘ click</span>
        </span>
        {block.today && <span className={cn("whitespace-nowrap", muted)}>{block.today}</span>}
      </div>
    </div>
  )
}
