import type { Metadata } from "next"
import type { ReactNode } from "react"
import Link from "next/link"
import { Nav } from "@/components/landing/nav"
import { Footer } from "@/components/landing/footer"
import { AdComposer } from "@/components/advertisers/ad-composer"

export const metadata: Metadata = {
  title: "Advertise on Distro TV — the ad exchange for AI agent surfaces",
  description:
    "Write an ad and run it in developers' terminals while their AI agent works. Import from Google Ads and Meta Ads soon.",
  alternates: { canonical: "/advertisers" },
}

// text labels only — no third-party marks
const IMPORTS = [
  {
    name: "Google Ads",
    body: "Search ads are text. So is the slot. They import one to one.",
    when: "coming soon",
  },
  {
    name: "Meta Ads",
    body: "Headline, text and link come across. Images stay behind.",
    when: "coming soon",
  },
  { name: "Amazon Ads", body: "Sponsored Brands headlines.", when: "next" },
]

const STEPS = [
  "You write or import an ad.",
  "It shows while a developer waits on their agent.",
  "You pay only for views of a second or more.",
]

function H2({ children }: { children: ReactNode }) {
  return (
    <h2
      className="mb-8 border-b border-[var(--rule-default)] pb-4 font-display text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink-primary)]"
      style={{ fontWeight: 400 }}
    >
      {children}
    </h2>
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
            <h1
              className="mb-5 max-w-[18ch] font-display text-[30px] md:text-[40px] leading-[1.06] tracking-[-0.025em] text-[var(--ink-primary)]"
              style={{ fontWeight: 400 }}
            >
              Reach developers while their agent works.
            </h1>
            <p className="mb-7 max-w-[52ch] font-body text-[15px] leading-[1.6] text-[var(--ink-secondary)]">
              Write an ad. It runs in developers&apos; terminals. Soon, bring the ads you already
              run.
            </p>
            <Link
              href="/advertisers/portal"
              className="inline-block bg-[var(--ink-primary)] px-4 py-2 font-body text-[13px] font-medium text-[var(--bg-primary)] no-underline transition-colors duration-150 hover:bg-[var(--em-hover)]"
            >
              Open the ad portal
            </Link>
          </div>
        </section>

        {/* imports first */}
        <section className="border-y border-[var(--rule-default)] bg-[var(--bg-surface)] py-14 md:py-20">
          <div className="mx-auto max-w-[1200px] px-6">
            <H2>Start from an ad you already run</H2>
            <div className="grid gap-px border border-[var(--rule-default)] bg-[var(--rule-default)] md:grid-cols-3">
              {IMPORTS.map((item) => (
                <div key={item.name} className="flex flex-col bg-[var(--bg-primary)] p-5">
                  <h3
                    className="mb-2 font-display text-[18px] tracking-[-0.02em] text-[var(--ink-primary)]"
                    style={{ fontWeight: 400 }}
                  >
                    {item.name}
                  </h3>
                  <p className="mb-5 flex-1 font-body text-[14px] leading-[1.6] text-[var(--ink-secondary)]">
                    {item.body}
                  </p>
                  <span className="font-data text-[12px] text-[var(--ink-tertiary)]">
                    {item.when}
                  </span>
                </div>
              ))}
            </div>
            <p className="m-0 mt-4 font-body text-[14px] text-[var(--ink-secondary)]">
              Read-only. We copy the ad. We never touch your campaigns.
            </p>
          </div>
        </section>

        {/* the composer — this page's one bold thing */}
        <section id="write" className="bg-[var(--bg-primary)] py-14 md:py-20 scroll-mt-20">
          <div className="mx-auto max-w-[1200px] px-6">
            <H2>Or write one now</H2>
            <AdComposer />
          </div>
        </section>

        {/* how it runs */}
        <section className="border-t border-[var(--rule-default)] bg-[var(--bg-secondary)] py-14 md:py-20">
          <div className="mx-auto max-w-[1200px] px-6">
            <H2>How it runs</H2>
            <ol className="m-0 grid list-none gap-5 p-0 md:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step} className="flex gap-3 font-body text-[15px] leading-[1.55]">
                  <span className="font-data text-[13px] leading-[1.8] text-[var(--accent-color)]">
                    {i + 1}
                  </span>
                  <span className="max-w-[30ch] text-[var(--ink-primary)]">{step}</span>
                </li>
              ))}
            </ol>
            <p className="m-0 mt-8 font-body text-[14px] leading-[1.6] text-[var(--ink-secondary)]">
              Live in the terminal today. IDE panels and agent apps next. Pilot: nothing is charged.
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
