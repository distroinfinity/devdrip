import type { ReactNode } from "react"
import Link from "next/link"
import { Logomark } from "@distrotv/design-system/components/logomark"
import { Wordmark } from "@distrotv/design-system/components/wordmark"
import { AdminPill } from "./admin-pill"

const NAV = [
  { href: "/", label: "overview" },
  { href: "/sources", label: "sources" },
  { href: "/tickers", label: "tickers" },
  { href: "/users", label: "users" },
  { href: "/metrics", label: "metrics" },
  { href: "/audit", label: "audit" },
]

interface Props {
  pathname: string
  systemStateReadout: ReactNode
  children: ReactNode
}

export function AdminShell({ pathname, systemStateReadout, children }: Props) {
  return (
    <div className="min-h-screen flex bg-[var(--bg-primary)]">
      <aside className="w-[200px] border-r border-[var(--rule-default)] flex flex-col">
        <div className="px-4 py-5 border-b border-[var(--rule-default)] flex items-center">
          <Logomark />
          <span className="ml-2">
            <Wordmark />
          </span>
          <AdminPill />
        </div>
        <nav className="flex flex-col py-3">
          {NAV.map((n) => {
            const active =
              n.href === "/"
                ? pathname === "/"
                : pathname === n.href || pathname.startsWith(`${n.href}/`)
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`px-4 py-2 text-[12px] font-[var(--font-body)] border-l-2 ${
                  active
                    ? "border-[var(--accent-color)] text-[var(--ink-primary)] font-medium"
                    : "border-transparent text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
                }`}
              >
                {n.label}
              </Link>
            )
          })}
        </nav>
        <div className="px-4 mt-auto pb-4">{systemStateReadout}</div>
      </aside>
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  )
}
