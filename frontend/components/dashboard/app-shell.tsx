import { DotGrid } from "@devdrip/design-system/components/dot-grid"
import { AppHeader } from "./app-header"
import { AppFooter } from "./app-footer"
import { NavPill } from "./nav-pill"
import { UserMenu } from "./user-menu"
import type { SessionUser } from "@/lib/auth"

interface AppShellProps {
  user: SessionUser
  activeNav: "earnings" | "impressions" | "analytics" | "preferences" | "wallet"
  children: React.ReactNode
}

export function AppShell({ user, activeNav, children }: AppShellProps) {
  const pills = (
    <>
      <NavPill href="/dashboard" label="Earnings" active={activeNav === "earnings"} />
      <NavPill href="#" label="Impressions" disabled soonLabel="soon" />
      <NavPill href="#" label="Analytics" disabled soonLabel="soon" />
      <NavPill href="#" label="Preferences" disabled soonLabel="soon" />
      <NavPill href="#" label="Wallet" disabled soonLabel="soon" />
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
