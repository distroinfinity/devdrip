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
  footerKeys = "[S]kip   [K]ill   [M]ute 30m",
  footerRight = "~/.distrotv/config.toml",
  className,
  variant = "card",
}: TerminalTVProps) {
  const isPreview = variant === "preview"

  return (
    <div
      className={cn(
        "font-data text-[11px] leading-[1.5]",
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
          {/* block head */}
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
              <span
                className={cn(
                  "inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle",
                  "bg-[var(--accent-color)]"
                )}
              />
              {block.title}
            </span>
            <span className={isPreview ? "text-[#5C5C66]" : "text-[var(--ink-tertiary)]"}>
              {block.status}
            </span>
          </div>

          {block.kind === "news" && (
            <div className="space-y-1.5">
              {block.items.map((item, i) => (
                <div key={i} className="grid grid-cols-[auto_1fr] gap-3 items-start">
                  <span
                    className={cn(
                      "text-[10px] uppercase tracking-wider pt-0.5 min-w-[80px]",
                      "text-[var(--accent-color)]"
                    )}
                  >
                    {item.source}
                  </span>
                  <span
                    className={cn(
                      "text-[12px] font-bold leading-snug",
                      isPreview ? "text-[#EDEDF0]" : "text-[var(--ink-primary)]"
                    )}
                  >
                    {item.headline}
                    <span
                      className={cn(
                        "block text-[9px] font-normal mt-0.5 tracking-wider",
                        isPreview ? "text-[#5C5C66]" : "text-[var(--ink-tertiary)]"
                      )}
                    >
                      {item.meta}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          )}

          {block.kind === "markets" && (
            <div className="space-y-0.5">
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
          "flex justify-between px-3 py-1.5 text-[10px]",
          isPreview
            ? "border-t border-[#1E1E22] text-[#5C5C66]"
            : "border-t border-[var(--rule-default)] text-[var(--ink-tertiary)]"
        )}
      >
        <span>{footerKeys}</span>
        <span>{footerRight}</span>
      </div>
    </div>
  )
}
