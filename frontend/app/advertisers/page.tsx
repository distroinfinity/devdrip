import type { Metadata } from "next"
import type { ReactNode } from "react"
import { Nav } from "@/components/landing/nav"
import { Footer } from "@/components/landing/footer"
import { TerminalTV } from "@/components/landing/terminal-tv"
import { SharpButton } from "@/components/v5/sharp-button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Advertise on Distro — the ad exchange for AI agent surfaces",
  description:
    "Bid for developer attention during AI agent runs. Open exchange, starting with the terminal. Self-serve coming soon.",
  alternates: { canonical: "/advertisers" },
}

// confirm address with owner
const TALK_TO_US = "mailto:ads@distrotv.xyz?subject=Advertising%20on%20Distro"

const WHY = [
  {
    title: "Undivided attention",
    body: "The ad shows while they wait. Never while they work.",
  },
  {
    title: "A technical audience",
    body: "Every viewer is a developer using AI coding tools.",
  },
  {
    title: "Paid, opted-in viewers",
    body: "Developers choose to see ads. They get paid a share of what you spend.",
  },
]

const BIDDING = [
  { step: "1", title: "Pick your audience", detail: "language, stack, tools, region" },
  { step: "2", title: "Set a CPM bid and budget" },
  { step: "3", title: "Win slots in an open auction" },
  { step: "4", title: "Pay only for ads that were on screen for at least a second" },
]

const SURFACES = [
  { name: "Terminal status line", when: "live today", live: true },
  { name: "IDE agent panels", when: "next", live: false },
  { name: "Agent web UIs", when: "next", live: false },
  { name: "CLI tools and build output", when: "later", live: false },
]

const CAMPAIGN_ACTIONS = ["Import from Google Ads", "Import from Meta Ads", "Create a campaign"]

function SectionHead({ tag, children }: { tag?: string; children: ReactNode }) {
  return (
    <div className="pb-4 mb-8 border-b border-[var(--rule-default)] flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2
        className="font-display text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink-primary)]"
        style={{ fontWeight: 400 }}
      >
        {children}
      </h2>
      {tag && <Tag>{tag}</Tag>}
    </div>
  )
}

function Tag({ children, live = false }: { children: ReactNode; live?: boolean }) {
  return (
    <span
      className={cn(
        "whitespace-nowrap font-data text-[12px]",
        live ? "text-[var(--status-positive)]" : "text-[var(--ink-tertiary)]"
      )}
    >
      {children}
    </span>
  )
}

export default function AdvertisersPage() {
  return (
    <>
      <Nav />
      <main>
        {/* hero */}
        <section className="relative">
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "radial-gradient(circle, var(--dot-grid-color) 1px, transparent 1px)",
              backgroundSize: "16px 16px",
              opacity: 0.5,
            }}
          />
          <div className="relative mx-auto max-w-[1200px] px-6 py-14 md:py-20">
            <div className="grid md:grid-cols-[1.05fr_1fr] gap-8 md:gap-12 items-start">
              <div>
                <p className="font-data text-[12px] text-[var(--ink-secondary)] mb-5">
                  distro exchange · pilot
                </p>
                <h1
                  className="font-display text-[30px] md:text-[38px] leading-[1.06] tracking-[-0.025em] text-[var(--ink-primary)] mb-4"
                  style={{ fontWeight: 400 }}
                >
                  Reach developers while their agent works.
                </h1>
                <p className="font-body text-[14px] leading-[1.6] text-[var(--ink-secondary)] mb-6 max-w-[52ch]">
                  Developers wait while their agent works. Distro turns that wait into ad inventory.
                  It starts in the terminal.
                </p>
                <a
                  href={TALK_TO_US}
                  className="inline-block bg-[var(--ink-primary)] px-4 py-2 font-body text-[13px] font-medium text-[var(--bg-primary)] no-underline transition-colors duration-150 hover:bg-[var(--em-hover)]"
                >
                  Talk to us
                </a>
              </div>

              <TerminalTV
                pathLabel="~ · agent working"
                statusLabel="● slot open"
                blocks={[
                  {
                    kind: "sponsored",
                    id: "adv-slot",
                    advertiser: "Your brand",
                    copy: "One line of copy, in front of a developer waiting on their agent.",
                    url: "https://yoursite.com",
                    est: "+$0.0070",
                  },
                ]}
                footerKeys="text only, one slot, twelve seconds"
                footerRight=""
              />
            </div>
          </div>
        </section>

        {/* why this inventory */}
        <section className="bg-[var(--bg-secondary)] py-14 md:py-20">
          <div className="mx-auto max-w-[1200px] px-6">
            <SectionHead>Why this inventory</SectionHead>
            <div className="grid md:grid-cols-3 gap-5">
              {WHY.map((card) => (
                <div
                  key={card.title}
                  className="bg-[var(--bg-surface)] border border-[var(--rule-default)] p-5"
                >
                  <h3
                    className="font-display text-[18px] tracking-[-0.02em] text-[var(--ink-primary)] mb-2 leading-snug"
                    style={{ fontWeight: 400 }}
                  >
                    {card.title}
                  </h3>
                  <p className="font-body text-[13px] text-[var(--ink-secondary)] leading-relaxed">
                    {card.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* how bidding will work */}
        <section className="bg-[var(--bg-primary)] py-14 md:py-20">
          <div className="mx-auto max-w-[1200px] px-6">
            <SectionHead tag="planned">How bidding will work</SectionHead>
            <ol className="m-0 p-0 list-none border border-[var(--rule-default)] bg-[var(--bg-surface)]">
              {BIDDING.map((b) => (
                <li
                  key={b.step}
                  className="grid grid-cols-[28px_1fr] gap-3 items-baseline px-4 py-3.5 border-b border-[var(--rule-subtle)] last:border-b-0"
                >
                  <span className="font-data text-[12px] font-bold text-[var(--accent-color)]">
                    {b.step}
                  </span>
                  <span>
                    <span className="font-body text-[14px] text-[var(--ink-primary)]">
                      {b.title}
                    </span>
                    {b.detail && (
                      <span className="block mt-0.5 font-data text-[11px] text-[var(--ink-secondary)]">
                        {b.detail}
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* surfaces */}
        <section className="border-y border-[var(--rule-default)] bg-[var(--bg-surface)] py-14 md:py-20">
          <div className="mx-auto max-w-[1200px] px-6">
            <SectionHead>Surfaces</SectionHead>
            <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:gap-12 items-start">
              <p className="font-body text-[14px] leading-[1.6] text-[var(--ink-secondary)] max-w-[48ch]">
                One exchange. More surfaces over time.
              </p>
              <ul className="m-0 p-0 list-none border border-[var(--rule-default)] bg-[var(--bg-primary)]">
                {SURFACES.map((s) => (
                  <li
                    key={s.name}
                    className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--rule-subtle)] last:border-b-0"
                  >
                    <span
                      className={cn(
                        "font-body text-[14px]",
                        s.live ? "text-[var(--ink-primary)]" : "text-[var(--ink-secondary)]"
                      )}
                    >
                      {s.name}
                    </span>
                    <Tag live={s.live}>{s.when}</Tag>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* bring your campaigns */}
        <section className="bg-[var(--bg-primary)] py-14 md:py-20">
          <div className="mx-auto max-w-[1200px] px-6">
            <SectionHead>Bring your campaigns</SectionHead>
            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
              {CAMPAIGN_ACTIONS.map((label) => (
                <SharpButton
                  key={label}
                  variant="secondary"
                  disabled
                  aria-disabled="true"
                  className="flex items-center justify-between gap-3 cursor-not-allowed text-left text-[var(--ink-secondary)] hover:border-[var(--rule-default)] disabled:opacity-100"
                >
                  <span>{label}</span>
                  <Tag>coming soon</Tag>
                </SharpButton>
              ))}
            </div>
            <p className="mt-4 font-body text-[13px] leading-[1.55] text-[var(--ink-secondary)] max-w-[60ch]">
              Self-serve opens after the pilot. Until then we run campaigns by hand.
            </p>
          </div>
        </section>

        {/* today */}
        <section className="bg-[var(--bg-secondary)] py-14 md:py-20">
          <div className="mx-auto max-w-[1200px] px-6">
            <SectionHead>Today</SectionHead>
            <p className="font-body text-[14px] leading-[1.6] text-[var(--ink-primary)] max-w-[70ch] mb-6">
              Live now: sandbox and demo ads in the terminal. Views and clicks are measured end to
              end.
            </p>
            <a
              href={TALK_TO_US}
              className="font-data text-[11px] text-[var(--accent-color)] border-b border-[var(--accent-color)] pb-0.5 hover:text-[var(--accent-hover)] no-underline"
            >
              Talk to us
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
