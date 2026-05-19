"use client"

import { motion } from "motion/react"
import { InstallCommand } from "./install-command"

export function InstallSection() {
  return (
    <section id="install" className="bg-[var(--bg-secondary)] py-14 md:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="pb-4 mb-8 border-b border-[var(--rule-default)]"
        >
          <p className="font-data text-[10px] uppercase tracking-[0.1em] text-[var(--ink-secondary)] mb-1.5">
            <span className="text-[var(--ink-tertiary)]">/ </span>install
          </p>
          <h2
            className="font-display text-[24px] md:text-[28px] tracking-[-0.02em] text-[var(--ink-primary)]"
            style={{ fontWeight: 400 }}
          >
            One line. Then <code className="font-data text-[20px] md:text-[24px]">distro init</code>
            .
          </h2>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.05 }}
        >
          <InstallCommand variant="large" />

          <div className="mt-5 flex flex-wrap gap-4 font-body text-[13px] text-[var(--ink-secondary)]">
            <span>Requires Node 20+.</span>
            <span className="text-[var(--ink-tertiary)]">·</span>
            <span>macOS and Linux.</span>
            <span className="text-[var(--ink-tertiary)]">·</span>
            <span>Windows via WSL.</span>
          </div>

          <p className="mt-2 font-body text-[13px] text-[var(--ink-secondary)]">
            Then run{" "}
            <code className="font-data text-[12px] bg-[var(--bg-inset)] px-1.5 py-0.5">
              distro init
            </code>{" "}
            and you're broadcasting.
          </p>

          <details className="mt-6 border border-[var(--rule-default)] bg-[var(--bg-surface)]">
            <summary className="cursor-pointer px-4 py-3 font-data text-[12px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]">
              What does this script do?
            </summary>
            <div className="px-4 pb-4 font-body text-[13px] text-[var(--ink-secondary)] leading-relaxed">
              Detects Node 20+, downloads the latest cli release tarball from GitHub Releases,
              extracts to
              <code className="font-data text-[12px] mx-1">~/.distrotv</code>, and drops a wrapper
              at
              <code className="font-data text-[12px] mx-1">~/.local/bin/distro</code>. No npm. No
              global node_modules. Source:{" "}
              <a
                className="text-[var(--accent-color)] no-underline border-b border-[var(--accent-color)] pb-0.5"
                href="/install.sh"
                target="_blank"
                rel="noreferrer"
              >
                /install.sh
              </a>
              .
            </div>
          </details>
        </motion.div>
      </div>
    </section>
  )
}
