const STATS = [
  { value: "15–60 min", label: "idle per day" },
  { value: "30s+", label: "per agentic task" },
  { value: "85%", label: "of developers use AI tools" },
  { value: "rising", label: "as agents take longer tasks" },
]

export function ShiftSection() {
  return (
    <section
      id="shift"
      className="border-y border-[var(--rule-default)] bg-[var(--bg-surface)] py-14 md:py-20"
    >
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="grid gap-8 md:grid-cols-[1fr_1.1fr] md:gap-12 items-start">
          <div>
            <h2
              className="font-display text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink-primary)] mb-4 max-w-[26ch]"
              style={{ fontWeight: 400 }}
            >
              Work moved to the agent. Attention stayed put.
            </h2>
            <p className="font-body text-[15px] leading-[1.65] text-[var(--ink-secondary)] max-w-[54ch]">
              A developer hands a task to an agent and waits. Thirty seconds, two minutes, ten. They
              don&apos;t leave; they watch the terminal. Over a day that adds up to somewhere
              between fifteen minutes and an hour of focused, idle attention, and it grows every
              time agents get better at longer tasks.
            </p>
          </div>

          <div>
            {/* 1px gaps over a rule-colored bed draw the cell borders */}
            <dl className="m-0 grid grid-cols-2 gap-px border border-[var(--rule-default)] bg-[var(--rule-default)]">
              {STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="flex flex-col-reverse justify-end bg-[var(--bg-primary)] px-4 py-5 md:px-5"
                >
                  <dt className="mt-2 font-data text-[11px] text-[var(--ink-secondary)]">
                    {stat.label}
                  </dt>
                  <dd
                    className="m-0 font-display text-[22px] md:text-[26px] leading-none tracking-[-0.02em] text-[var(--ink-primary)]"
                    style={{ fontWeight: 400 }}
                  >
                    {stat.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 font-data text-[10px] leading-relaxed text-[var(--ink-tertiary)]">
              figures from public developer surveys and our own usage; directional, not audited.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
