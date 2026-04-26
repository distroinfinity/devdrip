import { DotGrid } from "@devdrip/design-system/components/dot-grid"
import { AppHeader } from "./app-header"
import { AppFooter } from "./app-footer"
import { NavPill } from "./nav-pill"
import { UserMenu } from "./user-menu"
import type { SessionUser } from "@/lib/auth"

interface AppShellProps {
  user: SessionUser
  children: React.ReactNode
}

export function AppShell({ user, children }: AppShellProps) {
  // NavPill reads the current pathname client-side so each page renders the
  // right active state without the layout having to know which one it is.
  const pills = (
    <>
      <NavPill href="/dashboard" label="Earnings" exact />
      <NavPill href="/dashboard/history" label="History" />
      <NavPill href="/dashboard/analytics" label="Analytics" />
      <NavPill href="/dashboard/preferences" label="Preferences" />
      <NavPill href="/dashboard/wallet" label="Wallet" />
    </>
  )

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--bg-primary)] text-[var(--ink-primary)]">
      <DotGrid spacing={24} opacity={0.14} className="!fixed !inset-0 !-z-10" />

      <AppHeader
        homeHref="/dashboard"
        nav={pills}
        actions={<UserMenu user={user} />}
        mobileNav={pills}
      />

      <main className="mx-auto w-full max-w-grid flex-1 px-6 py-10 md:px-12">{children}</main>

      <AppFooter />
    </div>
  )
}
