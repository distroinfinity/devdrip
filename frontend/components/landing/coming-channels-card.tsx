const FUTURE_CHANNELS = [
  { id: "CH 03", name: "Weather" },
  { id: "CH 04", name: "Build Status" },
  { id: "CH 05", name: "Deploy Logs" },
  { id: "CH 06", name: "Sports" },
  { id: "CH 07", name: "Calendar" },
  { id: "CH 08", name: "Crypto Deep" },
]

const SUBMIT_URL = "https://github.com/distroinfinity/devdrip/discussions/categories/channel-ideas"

export function ComingChannelsCard() {
  return (
    <div className="mt-6 border border-dashed border-[var(--rule-strong)] bg-[var(--bg-surface)]/40 px-6 py-5 grid md:grid-cols-[1fr_2fr] gap-5 items-start">
      <div>
        <div className="font-data text-[11px] tracking-[0.08em] text-[var(--ink-tertiary)] mb-1.5">
          CH 0? · COMING
        </div>
        <h3
          className="font-display text-[18px] text-[var(--ink-secondary)] mb-2"
          style={{ fontWeight: 400 }}
        >
          Channels in the queue.
        </h3>
        <a
          href={SUBMIT_URL}
          target="_blank"
          rel="noreferrer"
          className="font-data text-[11px] text-[var(--accent-color)] border-b border-[var(--accent-color)] pb-0.5 hover:text-[var(--accent-hover)] no-underline"
        >
          submit a channel idea →
        </a>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-x-3 gap-y-1">
        {FUTURE_CHANNELS.map((c) => (
          <div
            key={c.id}
            className="font-data text-[11px] text-[var(--ink-secondary)] py-1 border-b border-[var(--rule-subtle)]"
          >
            <span className="text-[var(--ink-tertiary)] mr-2">{c.id}</span>
            {c.name}
          </div>
        ))}
      </div>
    </div>
  )
}
