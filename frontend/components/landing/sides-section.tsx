const SIDES = [
  {
    name: "People",
    body: "Opt in, see a slot while the agent works, and keep 70% of what it earns. Or tune the slot to a channel and see no ads at all.",
    live: "live",
    rest: "",
  },
  {
    name: "Surfaces",
    body: "Any agent tool can carry a slot: terminals, IDE agent panels, agent web apps, CLIs. The terminal is live. The others carry the same slot next.",
    live: "terminal live",
    rest: ", more next",
  },
  {
    name: "Advertisers",
    body: "Bid for developer attention by stack, tool and region, and pay only for ads that were on screen for at least a second. Early campaigns are run by hand while the exchange is built.",
    live: "",
    rest: "planned",
  },
]

export function SidesSection() {
  return (
    <section id="sides" className="bg-[var(--bg-secondary)] py-14 md:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <h2
          className="font-display text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink-primary)] pb-4 mb-8 border-b border-[var(--rule-default)]"
          style={{ fontWeight: 400 }}
        >
          Three sides, one slot.
        </h2>

        <div className="grid md:grid-cols-3 gap-5">
          {SIDES.map((side) => (
            <div
              key={side.name}
              className="flex flex-col bg-[var(--bg-surface)] border border-[var(--rule-default)] p-5"
            >
              <h3
                className="font-display text-[18px] tracking-[-0.02em] text-[var(--ink-primary)] mb-2"
                style={{ fontWeight: 400 }}
              >
                {side.name}
              </h3>
              <p className="font-body text-[14px] leading-[1.6] text-[var(--ink-secondary)] mb-5 flex-1">
                {side.body}
              </p>
              <span className="font-data text-[12px] text-[var(--ink-secondary)]">
                <span className="text-[var(--status-positive)]">{side.live}</span>
                {side.rest}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
