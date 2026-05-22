import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { getSession } from "@/lib/session"
import { SharpButton } from "@/components/v5/sharp-button"

export const metadata: Metadata = {
  title: "Sign in — Distro TV",
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ error?: string; next?: string }>
}

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams
  const session = await getSession()
  if (session?.email) {
    redirect(params.next ?? "/dashboard")
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[var(--bg-primary)]">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="font-[var(--font-display)] text-[22px] font-bold tracking-[-0.02em] text-[var(--ink-primary)]">
            Sign in to Distro TV
          </h1>
          <p className="mt-2 text-[13px] font-[var(--font-body)] text-[var(--ink-secondary)]">
            Continue with your GitHub account.
          </p>
        </div>

        {params.error && (
          <div className="px-3 py-2 bg-[var(--status-negative-surface)] border border-[var(--status-negative)] text-[var(--status-negative)] text-[13px] font-[var(--font-body)]">
            {describeError(params.error)}
          </div>
        )}

        <form action="/auth/github/start" method="get" className="space-y-3">
          <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
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
    case "throttled":
      return "Too many sign-in attempts. Wait a minute and try again."
    case "network":
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
      return `Something went wrong (${code}). Try again.`
  }
}
