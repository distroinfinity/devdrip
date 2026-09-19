import Link from "next/link"
import { getSession } from "@/lib/session"

// after the cli pairs, onboarding (channels/watchlist) happens in the terminal —
// the browser just confirms sign-in and points back to the terminal.
export default async function SetupDonePage() {
  const session = await getSession()
  const who = session?.email ? session.email.split("@")[0] : null

  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[var(--bg-primary)] px-6 py-16">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, var(--dot-grid-color) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          opacity: 0.5,
        }}
        aria-hidden="true"
      />

      <div className="relative w-full max-w-[440px] border border-[var(--rule-default)] bg-[var(--bg-surface)] font-data text-[11px] leading-[1.5] text-[var(--ink-primary)] shadow-[0_8px_28px_rgba(14,14,17,0.08)]">
        <div className="flex items-center gap-1.5 border-b border-[var(--rule-default)] bg-[var(--bg-primary)] px-3 py-2 text-[10px] tracking-wider text-[var(--ink-tertiary)]">
          <span className="h-2 w-2 rounded-full border border-[var(--rule-strong)]" />
          <span className="h-2 w-2 rounded-full border border-[var(--rule-strong)]" />
          <span className="h-2 w-2 rounded-full border border-[var(--rule-strong)]" />
          <span className="ml-2">~ · distro tv · device pairing</span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-color)]" />
            paired
          </span>
        </div>

        <div className="px-6 py-7">
          <p className="mb-4 flex items-center font-data text-[10px] uppercase tracking-[0.1em] text-[var(--ink-secondary)]">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-color)]" />
            device paired
          </p>

          <h1
            className="mb-3 font-display text-[26px] leading-[1.08] tracking-[-0.025em] text-[var(--ink-primary)]"
            style={{ fontWeight: 400 }}
          >
            You&apos;re in{who ? `, @${who}` : ""}.
          </h1>

          <p className="mb-6 max-w-[40ch] font-body text-[13px] leading-[1.55] text-[var(--ink-secondary)]">
            Head back to your terminal — the CLI is finishing setup there. Pick your channels and
            watchlist in the wizard, and your slot starts broadcasting the next time your agent
            takes the keyboard.
          </p>

          <div className="mb-5 border border-dashed border-[var(--rule-default)] px-3 py-2 text-[var(--ink-secondary)]">
            <span className="text-[var(--ink-tertiary)]">$</span> return to your terminal →{" "}
            <span className="text-[var(--ink-primary)]">distro init</span> is waiting
          </div>

          <Link
            href="/dashboard"
            className="inline-block font-data text-[11px] text-[var(--ink-secondary)] no-underline border-b border-[var(--rule-default)] pb-0.5 transition-colors hover:text-[var(--ink-primary)]"
          >
            or open the dashboard →
          </Link>
        </div>

        <div className="flex justify-between border-t border-[var(--rule-default)] px-3 py-1.5 text-[10px] text-[var(--ink-tertiary)]">
          <span>[✓] paired · safe to close this tab</span>
          <span>~/.distrotv/config.toml</span>
        </div>
      </div>
    </main>
  )
}
