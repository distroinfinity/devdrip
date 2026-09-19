const BEATS = [
  {
    headline: "The agent takes over.",
    body: "A hook fires when your agent starts a task. No grace period, no pop-up.",
  },
  {
    headline: "A slot lights up.",
    body: "One text ad in the status line for twelve seconds, then the next. ⌘-click opens it.",
  },
  {
    headline: "You type. It's gone.",
    body: "The slot never competes for the keyboard. Start typing and it clears.",
  },
]

const COMMANDS = [
  { cmd: "dtv preferences", desc: "choose what plays" },
  { cmd: "dtv mute", desc: "thirty minutes of quiet" },
  { cmd: "dtv skip", desc: "next slot" },
  { cmd: "dtv kill-session", desc: "off until the next session" },
  { cmd: "dtv status", desc: "what it earned today" },
]

export function TerminalSection() {
  return (
    <section id="terminal" className="bg-[var(--bg-primary)] py-14 md:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="pb-4 mb-8 border-b border-[var(--rule-default)]">
          <h2
            className="font-display text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink-primary)] mb-2"
            style={{ fontWeight: 400 }}
          >
            Surface 01: the terminal.
          </h2>
          <p className="font-body text-[15px] leading-[1.6] text-[var(--ink-secondary)]">
            Works with Claude Code today. More agent tools next.
          </p>
        </div>

        {/* a true sequence, so the beats are numbered */}
        <ol className="m-0 grid list-none gap-5 p-0 md:grid-cols-3">
          {BEATS.map((beat, i) => (
            <li
              key={beat.headline}
              className="bg-[var(--bg-surface)] border border-[var(--rule-default)] p-5"
            >
              <div className="font-data text-[12px] text-[var(--accent-color)] mb-3">{i + 1}</div>
              <h3
                className="font-display text-[18px] leading-snug tracking-[-0.02em] text-[var(--ink-primary)] mb-2"
                style={{ fontWeight: 400 }}
              >
                {beat.headline}
              </h3>
              <p className="font-body text-[14px] leading-[1.6] text-[var(--ink-secondary)]">
                {beat.body}
              </p>
            </li>
          ))}
        </ol>

        <dl className="m-0 mt-8 grid gap-px border border-[var(--rule-default)] bg-[var(--rule-default)] sm:grid-cols-2 lg:grid-cols-5">
          {COMMANDS.map((c) => (
            <div key={c.cmd} className="bg-[var(--bg-surface)] px-4 py-3">
              <dt className="font-data text-[12px] font-bold text-[var(--ink-primary)]">{c.cmd}</dt>
              <dd className="m-0 mt-0.5 font-body text-[13px] text-[var(--ink-secondary)]">
                {c.desc}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
