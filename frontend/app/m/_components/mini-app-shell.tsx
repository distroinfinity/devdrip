import type { ReactNode } from "react"

interface MiniAppShellProps {
  title?: string
  children: ReactNode
}

// Tight mobile-first chrome for Mini App pages. Distinct from the dashboard's
// AppShell because Mini App runs in a webview without our standard nav, but
// rule colours + surface tokens stay aligned so it visually matches
// /dashboard/wallet.
export function MiniAppShell({ title, children }: MiniAppShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg-primary)] text-[var(--ink-primary)]">
      <header className="border-b border-[var(--rule-default)] bg-[var(--bg-surface)] px-5 py-4">
        <h1 className="text-base font-semibold tracking-tight">{title ?? "DevDrip"}</h1>
      </header>
      <main className="flex-1 px-5 py-6">
        <div className="mx-auto flex max-w-md flex-col gap-6">{children}</div>
      </main>
    </div>
  )
}
