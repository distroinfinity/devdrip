import type { SessionPayload } from "@/lib/session"

// simple details/summary dropdown — no radix dep for MVP
export function UserMenu({ user }: { user: Pick<SessionPayload, "email" | "userId"> }) {
  const display = user.email ?? user.userId.slice(0, 8)
  const initial = display.slice(0, 1).toUpperCase()

  return (
    <details className="relative select-none">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-[var(--rule-default)] bg-[var(--bg-surface)] px-2 py-1.5 transition-colors hover:bg-[var(--bg-surface-hover)]">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[var(--bg-inset)] font-display text-[11px] font-bold text-[var(--ink-secondary)]">
          {initial}
        </span>
        <span className="font-body text-[12px] font-medium text-[var(--ink-secondary)] max-md:hidden">
          {display}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="currentColor"
          className="text-[var(--ink-tertiary)]"
          aria-hidden
        >
          <path d="M5 7 1.5 3.5h7z" />
        </svg>
      </summary>

      <div className="absolute right-0 top-[calc(100%+6px)] z-[var(--z-dropdown)] w-[220px] rounded-md border border-[var(--rule-default)] bg-[var(--bg-elevated)] p-3 shadow-md">
        <p className="font-display text-[10px] uppercase tracking-[0.1em] text-[var(--ink-tertiary)]">
          Signed in as
        </p>
        <p className="mt-1 truncate font-body text-[13px] font-medium text-[var(--ink-primary)]">
          {user.email ?? "anonymous"}
        </p>
        <p className="truncate font-body text-[11px] text-[var(--ink-tertiary)] font-mono">
          {user.userId.slice(0, 12)}…
        </p>

        <hr className="my-3 border-[var(--rule-subtle)]" />

        <a
          href="/dashboard/account"
          className="block w-full rounded-sm px-2 py-1.5 text-left font-body text-[12px] text-[var(--ink-secondary)] transition-colors hover:bg-[var(--bg-surface-hover)]"
        >
          Account
        </a>
      </div>
    </details>
  )
}
