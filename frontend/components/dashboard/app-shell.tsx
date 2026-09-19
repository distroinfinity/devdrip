import type { ChannelMode } from "@distrotv/shared"
import { DotGrid } from "@distrotv/design-system/components/dot-grid"
import { AppHeader } from "./app-header"
import { AppFooter } from "./app-footer"
import { NavPill } from "./nav-pill"
import { UserMenu } from "./user-menu"
import { ModeToggle } from "./mode-toggle"
import type { SessionPayload } from "@/lib/session"

interface AppShellProps {
  user: Pick<SessionPayload, "email" | "userId">
  initialMode: ChannelMode
  children: React.ReactNode
}

export function AppShell({ user, initialMode, children }: AppShellProps) {
  // NavPill reads the current pathname client-side so each page renders the
  // right active state without the layout having to know which one it is.
  const pills = (
    <>
      <NavPill href="/dashboard" label="Overview" exact />
      <NavPill href="/dashboard/reading" label="Reading" />
      <NavPill href="/dashboard/watchlists" label="Watchlists" />
      <NavPill href="/dashboard/preferences" label="Preferences" />
      <NavPill href="/dashboard/account" label="Account" />
    </>
  )

  const actions = (
    <div className="flex items-center gap-3">
      <ModeToggle initial={initialMode} />
      <UserMenu user={user} />
    </div>
  )

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--bg-primary)] text-[var(--ink-primary)]">
      <DotGrid spacing={24} opacity={0.14} className="!fixed !inset-0 !-z-10" />

      <AppHeader homeHref="/dashboard" nav={pills} actions={actions} mobileNav={pills} />

      <main className="mx-auto w-full max-w-grid flex-1 px-6 py-10 md:px-12">{children}</main>

      <AppFooter />
    </div>
  )
}
