import Link from "next/link"
import { Wordmark } from "@distrotv/design-system/components/wordmark"
import { ThemeToggle } from "@distrotv/design-system/components/theme-toggle"
import { InstallCommand } from "./install-command"

const LINKS = [
  { href: "#channels", label: "channels" },
  { href: "#how-it-works", label: "how it works" },
  { href: "#control", label: "control" },
  { href: "https://github.com/distroinfinity/devdrip", label: "github", external: true },
]

export function Nav() {
  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[var(--rule-default)] bg-[var(--bg-primary)]/85 backdrop-blur-sm">
      <div className="mx-auto max-w-[1200px] flex items-center justify-between px-6 py-3.5">
        <Link href="/" className="no-underline">
          <Wordmark size="md" />
        </Link>

        <div className="hidden md:flex items-center gap-5 font-data text-[11px]">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              {...(link.external ? { target: "_blank", rel: "noreferrer" } : {})}
              className="text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] transition-colors no-underline"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:block">
            <InstallCommand variant="pill" />
          </div>
          <ThemeToggle />
        </div>
      </div>
    </nav>
  )
}
