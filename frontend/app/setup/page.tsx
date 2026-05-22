import { redirect } from "next/navigation"
import { rememberPairCode } from "./actions"
import { getSession, getPairCookie } from "@/lib/session"
import { SharpButton } from "@/components/v5/sharp-button"

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

  // first arrival from CLI: pair code in URL → stash in cookie + redirect to clean URL
  if (params.pair && !session) {
    await rememberPairCode(params.pair)
    redirect("/setup")
  }

  // pair cookie present from a prior redirect → show GitHub button with pair
  const pair = await getPairCookie()
  if (pair) {
    return <ChooseSignInState pairingCode={pair} error={params.error} />
  }

  // no pair, no session → user manually navigated; redirect to sign-in page
  redirect("/sign-in")
}

function ChooseSignInState({ pairingCode, error }: { pairingCode: string; error?: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[var(--bg-primary)]">
      <div className="max-w-md w-full space-y-6">
        <div>
          <h1 className="font-[var(--font-display)] text-[22px] font-bold tracking-[-0.02em] text-[var(--ink-primary)]">
            Distro TV — Setup
          </h1>
          <p className="mt-2 text-[13px] font-[var(--font-body)] text-[var(--ink-secondary)]">
            Sign in with GitHub to finish setting up your CLI and unlock the dashboard.
          </p>
        </div>

        {error && (
          <div className="px-3 py-2 bg-[var(--status-negative-surface)] border border-[var(--status-negative)] text-[var(--status-negative)] text-[13px] font-[var(--font-body)]">
            {describeError(error)}
          </div>
        )}

        <form action="/auth/github/start" method="get" className="space-y-3">
          <input type="hidden" name="pair" value={pairingCode} />
          <input type="hidden" name="next" value="/setup/channels" />
          <SharpButton type="submit" variant="primary" className="w-full">
            Continue with GitHub
          </SharpButton>
        </form>

        <p className="font-[var(--font-data)] text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)] text-center">
          We use GitHub to identify you. We don&apos;t read your repos.
        </p>
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
