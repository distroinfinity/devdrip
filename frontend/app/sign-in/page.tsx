import type { Metadata } from "next"
import { DotGrid } from "@distrotv/design-system/components/dot-grid"
import { AppHeader } from "@/components/dashboard/app-header"
import { AppFooter } from "@/components/dashboard/app-footer"
import { IconGitHub } from "@/components/dashboard/icon-github"
import { authErrorMessage } from "@/lib/auth-errors"
import { PUBLIC_API_URL } from "@/lib/env"

export const metadata: Metadata = {
  title: "Sign in — Dev Drip",
  robots: { index: false, follow: false },
}

interface SearchParams {
  error?: string
}

export default function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const error = authErrorMessage(searchParams?.error ?? null)
  const oauthStart = `${PUBLIC_API_URL}/auth/github/redirect`

  return (
    <div className="relative flex min-h-screen flex-col bg-[var(--bg-primary)] text-[var(--ink-primary)]">
      <DotGrid spacing={24} opacity={0.14} className="!fixed !inset-0 !-z-10" />

      <AppHeader homeHref="/" />

      <main className="flex flex-1 items-center justify-center px-4 py-10">
        <div className="w-full max-w-[380px]">
          <div
            className="rounded-md border border-[var(--rule-default)] bg-[var(--bg-surface)] px-7 py-8"
            style={{ boxShadow: "var(--shadow-md)" }}
          >
            <p className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
              Dashboard
            </p>
            <h1 className="mt-3 font-display text-[22px] font-bold leading-[1.2] tracking-[-0.01em] text-[var(--ink-primary)]">
              Sign in.
            </h1>
            <p className="mt-2 font-body text-[13px] leading-[1.55] text-[var(--ink-secondary)]">
              GitHub auth. Shared session with the CLI.
            </p>

            {error && (
              <div
                role="alert"
                className="mt-5 rounded-sm border border-[var(--status-negative)]/40 bg-[var(--status-negative-surface)] px-3 py-2 font-body text-[12px] leading-[1.4] text-[var(--status-negative)]"
              >
                {error}
              </div>
            )}

            <a
              href={oauthStart}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-md bg-[var(--ink-primary)] px-4 py-2.5 font-body text-[14px] font-medium text-[var(--ink-inverse)] transition-colors hover:bg-[var(--em-hover)]"
            >
              <IconGitHub size={16} />
              Continue with GitHub
            </a>
          </div>

          <p className="mt-4 text-center font-data text-[10px] uppercase tracking-[0.12em] text-[var(--ink-faint)]">
            Authorized via GitHub OAuth · read:user, user:email
          </p>
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
