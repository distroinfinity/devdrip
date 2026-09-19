// the revenue structure, in the order the money moves — a real sequence, so it is numbered
const STEPS = [
  {
    title: "Advertisers pay Distro TV.",
    body: "They buy slots in front of developers. Only views of a second or more count.",
  },
  {
    title: "Distro TV runs the exchange.",
    body: "We place the ad and keep a margin.",
  },
  {
    title: "Developers get paid.",
    body: "Idle agent time earns money. It helps pay for the AI tools that cause it.",
  },
]

export function MoneySection() {
  return (
    <section id="how" className="bg-[var(--bg-secondary)] py-14 md:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2
          className="font-display text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink-primary)] pb-4 mb-8 border-b border-[var(--rule-default)]"
          style={{ fontWeight: 400 }}
        >
          How the money moves.
        </h2>

        <ol className="m-0 grid list-none gap-5 p-0 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="border border-[var(--rule-default)] bg-[var(--bg-surface)] p-5"
            >
              <span className="font-data text-[12px] tabular-nums text-[var(--ink-tertiary)]">
                {i + 1}
              </span>
              <h3
                className="mt-3 font-display text-[18px] leading-[1.25] tracking-[-0.02em] text-[var(--ink-primary)]"
                style={{ fontWeight: 400 }}
              >
                {step.title}
              </h3>
              <p className="mt-2 font-body text-[14px] leading-[1.6] text-[var(--ink-secondary)]">
                {step.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-8 grid gap-x-12 gap-y-3 font-body text-[14px] leading-[1.6] text-[var(--ink-secondary)] md:grid-cols-2">
          <p className="max-w-[52ch]">
            Opt-in only. The slot clears when you type. Prefer no ads? Tune it to news or markets.
          </p>
          <p className="max-w-[52ch]">
            <span className="text-[var(--status-positive)]">Live</span> in the terminal today. IDE
            panels and agent apps next. Bidding is planned; early campaigns run by hand.
          </p>
        </div>
      </div>
    </section>
  )
}
