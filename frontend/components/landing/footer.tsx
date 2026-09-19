import Link from "next/link"
import { Wordmark } from "@distrotv/design-system/components/wordmark"
import { ThemeToggle } from "@distrotv/design-system/components/theme-toggle"
import { HeartPixel } from "@distrotv/design-system/components/heart-pixel"

const COLS = [
  {
    label: "Product",
    items: [
      { label: "Channels", href: "#channels" },
      { label: "How it works", href: "#how-it-works" },
      { label: "Control", href: "#control" },
    ],
  },
  {
    label: "Resources",
    items: [
      { label: "GitHub", href: "https://github.com/distroinfinity/devdrip", external: true },
      {
        label: "Request a channel",
        href: "https://github.com/distroinfinity/devdrip/issues/new?template=channel-request.yml",
        external: true,
      },
      {
        label: "Community (WhatsApp)",
        href: "https://chat.whatsapp.com/ElNoFH46V31I9kw2RWrL6z?mode=gi_t",
        external: true,
      },
    ],
  },
  {
    label: "Build",
    items: [
      { label: "Dashboard", href: "/dashboard" },
      { label: "Sign in", href: "/sign-in" },
    ],
  },
]

export function Footer() {
  return (
    <footer className="bg-[var(--bg-primary)] border-t border-[var(--rule-default)]">
      <div className="mx-auto max-w-[1200px] px-6 py-12">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 mb-10">
          {COLS.map((col) => (
            <div key={col.label}>
              <h4 className="font-data text-[10px] uppercase tracking-[0.1em] text-[var(--ink-tertiary)] mb-3">
                {col.label}
              </h4>
              <ul className="space-y-2 m-0 p-0 list-none">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      {...("external" in item && item.external
                        ? { target: "_blank", rel: "noreferrer" }
                        : {})}
                      className="font-body text-[13px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] no-underline transition-colors"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="pt-5 border-t border-[var(--rule-default)] flex justify-between items-center flex-wrap gap-3 font-data text-[11px] text-[var(--ink-tertiary)]">
          <div className="flex items-center gap-3 flex-wrap">
            <Wordmark size="sm" />
            <span className="flex items-center gap-1.5">
              built with
              <HeartPixel className="text-[var(--accent-color)]" />
              by
              <Link
                href="https://x.com/distroinfinity"
                target="_blank"
                rel="noreferrer"
                className="text-[var(--ink-secondary)] hover:text-[var(--ink-primary)] no-underline border-b border-[var(--rule-default)] pb-px transition-colors"
              >
                manu
              </Link>
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span>v0.1.0</span>
            <span>·</span>
            <span>MIT</span>
            <span>·</span>
            <span>2026</span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </footer>
  )
}
