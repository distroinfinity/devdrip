import { ThemeToggle } from "@devdrip/design-system/components/theme-toggle"
import { BrandMark } from "./brand-mark"
import { SocialStrip } from "./social-strip"

interface AppHeaderProps {
  // slots — kept narrow on purpose so callers assemble their own content
  nav?: React.ReactNode
  actions?: React.ReactNode
  mobileNav?: React.ReactNode
  homeHref?: string
}

// shared chrome used by every page; dashboard fills `nav` + `actions` while
// sign-in leaves them empty so the header reduces to brand + socials + theme.
export function AppHeader({ nav, actions, mobileNav, homeHref = "/dashboard" }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-[var(--z-sticky)] border-b border-[var(--rule-default)] bg-[var(--bg-primary)]/90 backdrop-blur">
      <div className="mx-auto flex h-[64px] w-full max-w-grid items-center justify-between gap-4 px-6 md:px-12">
        <div className="flex items-center gap-8">
          <BrandMark href={homeHref} />
          {nav && (
            <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
              {nav}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-1">
          <SocialStrip className="hidden md:inline-flex" />
          <ThemeToggle />
          {actions}
        </div>
      </div>

      {mobileNav && (
        <nav
          className="flex items-center gap-1 overflow-x-auto border-t border-[var(--rule-subtle)] px-6 py-2 md:hidden"
          aria-label="Primary mobile"
        >
          {mobileNav}
        </nav>
      )}
    </header>
  )
}
