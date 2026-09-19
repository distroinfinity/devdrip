import type { ReactNode } from "react"
import type { ChannelMode } from "@distrotv/shared"
import { DotGrid } from "@distrotv/design-system/components/dot-grid"
import { AppHeader } from "./app-header"
import { AppFooter } from "./app-footer"
import { NavPill } from "./nav-pill"
import { UserMenu } from "./user-menu"
import { ModePill } from "./mode-pill"
import type { SessionPayload } from "@/lib/session"

interface AppShellProps {
  user: Pick<SessionPayload, "email" | "userId">
  initialMode: ChannelMode
  children: ReactNode
  configReadout?: ReactNode
}

export function AppShell({ user, initialMode, children, configReadout }: AppShellProps) {
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
      <ModePill initial={initialMode} />
      <UserMenu user={user} />
    </div>
  )

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--bg-primary)] text-[var(--ink-primary)]">
      <DotGrid spacing={24} opacity={0.14} className="!fixed !inset-0 !-z-10" />

      <AppHeader homeHref="/dashboard" nav={pills} actions={actions} mobileNav={pills} />

      <div className="mx-auto flex w-full max-w-grid flex-1 gap-0 px-6 md:px-12">
        {/* sidebar */}
        <aside className="hidden w-48 shrink-0 border-r border-[var(--rule-default)] pr-6 pt-10 md:block">
          <nav className="flex flex-col gap-0.5" aria-label="Sidebar">
            <NavPill href="/dashboard" label="Overview" exact sidebar />
            <NavPill href="/dashboard/reading" label="Reading" sidebar />
            <NavPill href="/dashboard/watchlists" label="Watchlists" sidebar />
            <NavPill href="/dashboard/preferences" label="Preferences" sidebar />
            <NavPill href="/dashboard/account" label="Account" sidebar />
          </nav>
          {configReadout && <div className="mt-2">{configReadout}</div>}
        </aside>

        {/* main content */}
        <main className="min-w-0 flex-1 py-10 md:pl-10">{children}</main>
      </div>

      <AppFooter />
    </div>
  )
}
