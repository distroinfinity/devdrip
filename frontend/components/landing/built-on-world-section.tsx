"use client"

import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { motion } from "motion/react"
import { cn } from "@/lib/utils"
import { BlurFade } from "@/components/ui/blur-fade"
import { DotGrid } from "@/components/shared/dot-grid"
import { WORLD_CHAIN_SEPOLIA, MIN_AUTO_DISBURSE_USDC } from "@devdrip/shared/constants/chain"

const WORLD_APP_ID = process.env["NEXT_PUBLIC_WORLD_APP_ID"] ?? ""

const BULLETS: Array<{ k: string; v: string }> = [
  {
    k: "Verified humans only",
    v: "World ID gates every wallet. No Sybil farms, no bot impressions, no fake clicks.",
  },
  {
    k: "Gasless USDC",
    v: "EIP-3009 transfers via the CDP facilitator. You never hold ETH; we cover gas.",
  },
  {
    k: "Auto-paid every Sunday",
    v: `Hot wallet sweeps once your balance crosses $${MIN_AUTO_DISBURSE_USDC.toFixed(0)}. No claim button to remember.`,
  },
]

function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export function BuiltOnWorldSection() {
  const deeplink = WORLD_APP_ID ? `https://world.org/mini-app?app_id=${WORLD_APP_ID}` : null
  const [qrSvg, setQrSvg] = useState<string>("")
  const [copy, setCopy] = useState<"idle" | "copied">("idle")

  useEffect(() => {
    if (!deeplink) return
    void QRCode.toString(deeplink, {
      type: "svg",
      margin: 1,
      color: { dark: "#0e0e11", light: "#00000000" },
    }).then(setQrSvg)
  }, [deeplink])

  const onCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(WORLD_CHAIN_SEPOLIA.usdcAddress)
      setCopy("copied")
      window.setTimeout(() => setCopy("idle"), 1500)
    } catch {
      // ignore
    }
  }

  const explorerAddrUrl = `${WORLD_CHAIN_SEPOLIA.blockExplorerUrl}/address/${WORLD_CHAIN_SEPOLIA.usdcAddress}`

  return (
    <section
      id="built-on-world"
      aria-labelledby="built-on-world-heading"
      className="relative bg-[var(--bg-secondary)] overflow-hidden scroll-mt-20"
    >
      <DotGrid opacity={0.25} variant="static" />

      <div className="relative mx-auto max-w-grid px-6 py-24 lg:py-28">
        <BlurFade inView delay={0}>
          <div className="flex flex-col items-center text-center mb-12 lg:mb-16">
            <div className="font-data text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.18em] mb-3">
              The Rail
            </div>
            <h2
              id="built-on-world-heading"
              className="font-display text-h2 md:text-h1 font-bold text-[var(--ink-primary)] tracking-[-0.02em] mb-4 max-w-[720px]"
            >
              Settled on World Chain.
              <br />
              Paid to verified humans only.
            </h2>
            <p className="font-body text-body text-[var(--ink-secondary)] max-w-[560px]">
              Every wallet is gated by World ID. Every payout lands as USDC on World Chain. We sweep
              weekly so you never think about it.
            </p>
          </div>
        </BlurFade>

        <div className="grid gap-6 lg:gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          {/* left: explainer card */}
          <BlurFade inView delay={0.1}>
            <article
              className={cn(
                "h-full flex flex-col gap-6",
                "rounded-md border border-[var(--rule-default)] bg-[var(--bg-surface)]",
                "px-6 py-7 lg:px-8 lg:py-9"
              )}
            >
              <ul className="flex flex-col gap-5">
                {BULLETS.map((b, i) => (
                  <motion.li
                    key={b.k}
                    initial={{ opacity: 0, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-80px" }}
                    transition={{ duration: 0.35, delay: i * 0.06, ease: [0.16, 1, 0.3, 1] }}
                    className="flex items-start gap-3"
                  >
                    <span
                      aria-hidden
                      className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-color)]"
                    />
                    <div>
                      <div className="font-body text-[14px] font-semibold text-[var(--ink-primary)]">
                        {b.k}
                      </div>
                      <p className="font-body text-[13px] text-[var(--ink-secondary)] leading-relaxed mt-0.5">
                        {b.v}
                      </p>
                    </div>
                  </motion.li>
                ))}
              </ul>

              {/* chain meta footer */}
              <div className="mt-2 pt-5 border-t border-[var(--rule-subtle)] grid gap-2 sm:grid-cols-2">
                <Meta label="Chain">
                  <a
                    href={WORLD_CHAIN_SEPOLIA.blockExplorerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--ink-primary)] transition-colors"
                  >
                    {WORLD_CHAIN_SEPOLIA.name} · {WORLD_CHAIN_SEPOLIA.chainId}
                  </a>
                </Meta>
                <Meta label="USDC">
                  <button
                    type="button"
                    onClick={onCopyAddress}
                    title={WORLD_CHAIN_SEPOLIA.usdcAddress}
                    className="inline-flex items-center gap-1.5 hover:text-[var(--ink-primary)] transition-colors cursor-pointer"
                  >
                    <span>{shortAddr(WORLD_CHAIN_SEPOLIA.usdcAddress)}</span>
                    <span className="font-data text-[9px] uppercase tracking-[0.1em] text-[var(--ink-tertiary)]">
                      {copy === "idle" ? "[copy]" : "[copied]"}
                    </span>
                  </button>
                </Meta>
                <Meta label="Min payout">${MIN_AUTO_DISBURSE_USDC.toFixed(2)} · weekly</Meta>
                <Meta label="Explorer">
                  <a
                    href={explorerAddrUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-[var(--ink-primary)] transition-colors"
                  >
                    view contract ↗
                  </a>
                </Meta>
              </div>
            </article>
          </BlurFade>

          {/* right: mini-app open card */}
          <BlurFade inView delay={0.2}>
            <article
              className={cn(
                "h-full flex flex-col items-center text-center gap-5",
                "rounded-md border border-[var(--rule-default)] bg-[var(--bg-primary)]",
                "px-6 py-8 lg:px-8 lg:py-10"
              )}
            >
              <div className="font-data text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.18em]">
                Open in World App
              </div>

              <div
                className={cn(
                  "relative w-[200px] h-[200px] rounded-md flex items-center justify-center",
                  "bg-[var(--bg-surface)] border border-[var(--rule-subtle)]"
                )}
              >
                {qrSvg ? (
                  <div
                    aria-label="Mini app QR code"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                    className="w-[180px] h-[180px] [&>svg]:w-full [&>svg]:h-full"
                  />
                ) : (
                  <div className="px-4 text-center">
                    <div className="font-data text-[10px] tracking-[0.12em] uppercase text-[var(--ink-tertiary)] mb-2">
                      Mini app
                    </div>
                    <div className="font-body text-[12px] text-[var(--ink-secondary)] leading-relaxed">
                      QR appears once we publish to World App.
                    </div>
                  </div>
                )}
              </div>

              <p className="font-body text-[13px] text-[var(--ink-secondary)] max-w-[260px] leading-relaxed">
                Pair your CLI to a World ID wallet. No seed phrases, no browser extensions.
              </p>

              {deeplink ? (
                <a
                  href={deeplink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "inline-flex items-center justify-center h-10 px-5 rounded-sm",
                    "bg-[var(--ink-primary)] text-[var(--ink-inverse)]",
                    "font-body text-[13px] font-medium hover:bg-[var(--em-hover)] transition-colors"
                  )}
                >
                  Open World App
                </a>
              ) : (
                <span className="font-data text-[10px] uppercase tracking-[0.12em] text-[var(--ink-tertiary)]">
                  coming soon
                </span>
              )}
            </article>
          </BlurFade>
        </div>
      </div>
    </section>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-data text-[9px] font-semibold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
        {label}
      </span>
      <span className="font-data text-[12px] text-[var(--ink-secondary)] tabular-nums">
        {children}
      </span>
    </div>
  )
}
