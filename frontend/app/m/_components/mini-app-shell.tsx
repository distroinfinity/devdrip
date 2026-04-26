import type { ReactNode } from "react"

interface MiniAppShellProps {
  title?: string
  children: ReactNode
}

// Tight mobile-first chrome for Mini App pages. Distinct from the dashboard's
// AppShell because Mini App runs in a webview without our standard nav.
export function MiniAppShell({ title, children }: MiniAppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-primary)] text-[var(--ink-primary)]">
      <header className="border-b border-[var(--border-subtle)] px-4 py-3">
        <h1 className="text-base font-medium">{title ?? "DevDrip"}</h1>
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
    </div>
  )
}
