const FUTURE_CHANNELS = [
  { id: "CH 03", name: "Weather" },
  { id: "CH 04", name: "Build Status" },
  { id: "CH 05", name: "Deploy Logs" },
  { id: "CH 06", name: "Sports" },
  { id: "CH 07", name: "Calendar" },
  { id: "CH 08", name: "Crypto Deep" },
]

const SUBMIT_URL =
  "https://github.com/distroinfinity/devdrip/issues/new?template=channel-request.yml"

export function ComingChannelsCard() {
  return (
    <div className="mt-6 border border-[var(--rule-default)] bg-[var(--bg-surface)]/40 px-6 py-5 grid md:grid-cols-[1fr_2fr] gap-x-8 gap-y-5 items-start">
      <div>
        <div className="font-data text-[11px] tracking-[0.08em] text-[var(--ink-tertiary)] mb-1.5">
          CH 0? · COMING
        </div>
        <h3
          className="font-display text-[18px] text-[var(--ink-secondary)] mb-2"
          style={{ fontWeight: 400 }}
        >
          Next on the dial.
        </h3>
        <a
          href={SUBMIT_URL}
          target="_blank"
          rel="noreferrer"
          className="font-data text-[11px] text-[var(--accent-color)] border-b border-[var(--accent-color)] pb-0.5 hover:text-[var(--accent-hover)] no-underline"
        >
          request a channel →
        </a>
      </div>
      {/* dim channel lineup — each stub mirrors the "coming" chip language (dashed, no accent dot) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        {FUTURE_CHANNELS.map((c) => (
          <div
            key={c.id}
            className="group border border-dashed border-[var(--rule-default)] bg-[var(--bg-primary)]/40 px-3 py-2.5 transition-colors hover:border-[var(--rule-strong)]"
          >
            <div className="flex items-center justify-between">
              <span className="font-data text-[10px] tracking-[0.08em] text-[var(--ink-tertiary)]">
                {c.id}
              </span>
              <span className="font-data text-[8px] uppercase tracking-[0.18em] text-[var(--ink-faint)]">
                queued
              </span>
            </div>
            <div
              className="font-display text-[14px] leading-tight text-[var(--ink-secondary)] mt-1.5"
              style={{ fontWeight: 400 }}
            >
              {c.name}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
