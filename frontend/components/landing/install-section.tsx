import { InstallCommand } from "./install-command"

export function InstallSection() {
  return (
    <section id="install" className="bg-[var(--bg-secondary)] py-14 md:py-20">
      <div className="mx-auto max-w-[1200px] px-6">
        <div className="pb-4 mb-8 border-b border-[var(--rule-default)]">
          <h2
            className="font-display text-[24px] md:text-[28px] leading-[1.15] tracking-[-0.02em] text-[var(--ink-primary)] mb-2"
            style={{ fontWeight: 400 }}
          >
            Run the first surface.
          </h2>
          <p className="font-body text-[15px] leading-[1.6] text-[var(--ink-secondary)]">
            One command. macOS and Linux, Node 20 or newer. Works with Claude Code.
          </p>
        </div>

        <div>
          <InstallCommand variant="large" />

          <p className="mt-4 font-body text-[13px] text-[var(--ink-secondary)]">
            Then run{" "}
            <code className="font-data text-[12px] bg-[var(--bg-inset)] px-1.5 py-0.5">
              distro init
            </code>{" "}
            to pair this machine.
          </p>

          <details className="mt-6 border border-[var(--rule-default)] bg-[var(--bg-surface)]">
            <summary className="cursor-pointer px-4 py-3 font-data text-[12px] text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]">
              What does this script do?
            </summary>
            <div className="px-4 pb-4 font-body text-[13px] text-[var(--ink-secondary)] leading-relaxed">
              Checks Node 20+, downloads the latest release from GitHub, drops a wrapper at
              <code className="font-data text-[12px] mx-1">~/.local/bin/distro</code>. No npm.
              Source:{" "}
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
        </div>
      </div>
    </section>
  )
}
