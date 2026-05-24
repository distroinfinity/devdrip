import { redirect } from "next/navigation"
import { getSession, getPairCookie } from "@/lib/session"

interface PageProps {
  searchParams: Promise<{ pair?: string; error?: string }>
}

export default async function SetupPage({ searchParams }: PageProps) {
  const params = await searchParams
  const session = await getSession()

  // signed in → done; jump straight to the onboarding picker
  if (session?.email) {
    redirect("/setup/channels")
  }

  // pair code from the CLI url (falls back to a cookie from a prior visit). it
  // rides to github via the oauth-state set in /auth/github/start, so it never
  // needs persisting here — and cookies can't be written during a render.
  const pair = params.pair ?? (await getPairCookie())
  if (pair) {
    return <ChooseSignInState pairingCode={pair} error={params.error} />
  }

  // no pair, no session → user manually navigated; redirect to sign-in page
  redirect("/sign-in")
}

function GithubMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  )
}

function ChooseSignInState({ pairingCode, error }: { pairingCode: string; error?: string }) {
  const codeShort = pairingCode.slice(0, 8)
  return (
    <main className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[var(--bg-primary)] px-6 py-16">
      {/* dot-grid atmosphere — same surface as the landing */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: "radial-gradient(circle, var(--dot-grid-color) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
          opacity: 0.5,
        }}
        aria-hidden="true"
      />

      {/* broadcast panel */}
      <div className="relative w-full max-w-[440px] border border-[var(--rule-default)] bg-[var(--bg-surface)] font-data text-[11px] leading-[1.5] text-[var(--ink-primary)] shadow-[0_8px_28px_rgba(14,14,17,0.08)]">
        {/* frame head */}
        <div className="flex items-center gap-1.5 border-b border-[var(--rule-default)] bg-[var(--bg-primary)] px-3 py-2 text-[10px] tracking-wider text-[var(--ink-tertiary)]">
          <span className="h-2 w-2 rounded-full border border-[var(--rule-strong)]" />
          <span className="h-2 w-2 rounded-full border border-[var(--rule-strong)]" />
          <span className="h-2 w-2 rounded-full border border-[var(--rule-strong)]" />
          <span className="ml-2">~ · distro tv · device pairing</span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-color)]" />
            awaiting auth
          </span>
        </div>

        {/* body */}
        <div className="px-6 py-7">
          <p className="mb-4 flex items-center font-data text-[10px] uppercase tracking-[0.1em] text-[var(--ink-secondary)]">
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent-color)]" />
            step 1 of 2 · github sign-in
          </p>

          <h1
            className="mb-3 font-display text-[26px] leading-[1.08] tracking-[-0.025em] text-[var(--ink-primary)]"
            style={{ fontWeight: 400 }}
          >
            Pair this device.
            <span className="ml-1 inline-block h-[0.78em] w-[0.5ch] translate-y-[1px] animate-pulse bg-[var(--accent-color)] align-baseline" />
          </h1>

          <p className="mb-6 max-w-[40ch] font-body text-[13px] leading-[1.55] text-[var(--ink-secondary)]">
            Sign in with GitHub to connect your CLI and unlock the dashboard. Your channels start
            broadcasting the moment your agent takes the keyboard.
          </p>

          {error && (
            <div className="mb-5 border border-[var(--status-negative)] bg-[var(--status-negative-surface)] px-3 py-2 font-data text-[11px] leading-snug text-[var(--status-negative)]">
              {describeError(error)}
            </div>
          )}

          <form action="/auth/github/start" method="get">
            <input type="hidden" name="pair" value={pairingCode} />
            <input type="hidden" name="next" value="/setup/channels" />
            <button
              type="submit"
              className="group flex w-full items-center justify-center gap-2.5 rounded-none bg-[var(--ink-primary)] px-4 py-3 font-data text-[12px] font-bold tracking-wide text-[var(--bg-primary)] transition-colors duration-150 hover:bg-[var(--em-hover)]"
            >
              <GithubMark />
              Continue with GitHub
              <span className="opacity-50 transition-transform duration-150 group-hover:translate-x-0.5">
                →
              </span>
            </button>
          </form>

          {/* pair-code receipt — matches the code the CLI printed in your terminal */}
          <div className="mt-5 flex items-center justify-between border border-dashed border-[var(--rule-default)] px-3 py-2">
            <span className="font-data text-[10px] uppercase tracking-[0.08em] text-[var(--ink-tertiary)]">
              device pair
            </span>
            <span className="font-data text-[11px] text-[var(--ink-secondary)]">
              {codeShort}
              <span className="text-[var(--ink-tertiary)]">…</span>
            </span>
          </div>

          <p className="mt-5 font-data text-[10px] uppercase leading-relaxed tracking-[0.08em] text-[var(--ink-tertiary)]">
            we use github to identify you. we don&apos;t read your repos.
          </p>
        </div>

        {/* frame foot */}
        <div className="flex justify-between border-t border-[var(--rule-default)] px-3 py-1.5 text-[10px] text-[var(--ink-tertiary)]">
          <span>[⏎] continue · [ctrl-c] cancel in terminal</span>
          <span>~/.distrotv/config.toml</span>
        </div>
      </div>
    </main>
  )
}

function describeError(code: string): string {
  switch (code) {
    case "pair_code_unknown_or_expired":
    case "pair_expired":
      return "The pairing link expired. Pairing codes are valid for 10 minutes."
    case "device_not_found":
      return "The device this link belongs to has been deleted."
    case "throttled":
      return "Too many sign-in attempts. Wait a minute and try again."
    case "network_error":
      return "Couldn't reach the server. Check your network and try again."
    case "oauth_user_denied":
      return "GitHub sign-in was cancelled."
    case "oauth_csrf_failed":
    case "oauth_state_expired":
      return "Sign-in session expired. Please try again."
    case "no_verified_email":
      return "GitHub returned no verified primary email. Verify an email on GitHub and retry."
    case "github_rate_limited":
      return "GitHub is rate-limiting sign-in. Try again in a minute."
    case "github_unavailable":
      return "Couldn't reach GitHub. Try again in a moment."
    default:
      return `Something went wrong (${code}).`
  }
}
