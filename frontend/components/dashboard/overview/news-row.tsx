import type { ReactNode } from "react"

export interface NewsRowData {
  id: string
  title: string
  url: string
  source: string
  score?: number | null
  comments?: number | null
  createdAt: string
}

interface Props {
  item: NewsRowData
  index: number
  actions?: ReactNode
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const sec = Math.round(diff / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.round(hr / 24)
  return `${day}d ago`
}

function domain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return ""
  }
}

export function NewsRow({ item, index, actions }: Props) {
  const dom = domain(item.url)

  return (
    <div
      className="grid gap-3.5 py-3 border-b border-[var(--rule-2,var(--rule-default))] last:border-b-0"
      style={{ gridTemplateColumns: "28px 1fr auto" }}
    >
      {/* number */}
      <span className="font-[var(--font-data)] text-[11px] text-[var(--ink-faint,var(--ink-tertiary))] tabular-nums text-right pt-0.5">
        {index + 1}.
      </span>

      {/* body */}
      <div>
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block font-[var(--font-body)] text-[13.5px] font-medium text-[var(--ink-primary)] leading-snug hover:text-[var(--accent-color)] cursor-pointer no-underline"
        >
          {item.title}
        </a>
        <div className="mt-[3px] flex items-center gap-2 font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] tracking-[0.02em]">
          <span className="text-[var(--ink-secondary)] font-semibold tracking-[0.06em] uppercase">
            {item.source}
          </span>
          {item.score != null && (
            <>
              <span className="text-[var(--ink-faint,var(--ink-tertiary))]">·</span>
              <span>{item.score.toLocaleString("en-US")} pts</span>
            </>
          )}
          {item.comments != null && (
            <>
              <span className="text-[var(--ink-faint,var(--ink-tertiary))]">·</span>
              <span>{item.comments} comments</span>
            </>
          )}
          <span className="text-[var(--ink-faint,var(--ink-tertiary))]">·</span>
          <span>{timeAgo(item.createdAt)}</span>
          {dom && (
            <>
              <span className="text-[var(--ink-faint,var(--ink-tertiary))]">·</span>
              <span>{dom}</span>
            </>
          )}
        </div>
      </div>

      {/* actions */}
      <div className="flex items-start gap-1.5 pt-0.5">{actions}</div>
    </div>
  )
}
