import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { sendMagicLink } from "@/app/setup/actions"
import { getSession } from "@/lib/session"
import { SharpInput } from "@/components/v5/sharp-input"
import { SharpButton } from "@/components/v5/sharp-button"

export const metadata: Metadata = {
  title: "Sign in — Distro TV",
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ sent?: string; email?: string; error?: string; next?: string }>
}

export default async function SignInPage({ searchParams }: PageProps) {
  const params = await searchParams
  const session = await getSession()
  if (session?.email) {
    redirect(params.next ?? "/dashboard")
  }

  if (params.sent === "1" && params.email) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 bg-[var(--bg-primary)]">
        <div className="max-w-md text-center space-y-3">
          <h1 className="font-[var(--font-display)] text-[22px] font-bold tracking-[-0.02em] text-[var(--ink-primary)]">
            Check your email
          </h1>
          <p className="text-[13px] font-[var(--font-body)] text-[var(--ink-secondary)]">
            We sent a sign-in link to{" "}
            <strong className="text-[var(--ink-primary)]">{params.email}</strong>. Click the link to
            complete sign-in. The link expires in 15 minutes.
          </p>
          <p className="font-[var(--font-data)] text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)] pt-4">
            Didn&apos;t get it?{" "}
            <a href="/sign-in" className="text-[var(--accent-color)] hover:underline">
              Try again
            </a>
            .
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[var(--bg-primary)]">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="font-[var(--font-display)] text-[22px] font-bold tracking-[-0.02em] text-[var(--ink-primary)]">
            Sign in to Distro TV
          </h1>
          <p className="mt-2 text-[13px] font-[var(--font-body)] text-[var(--ink-secondary)]">
            Magic-link sign-in — no password.
          </p>
        </div>

        {params.error && (
          <div className="px-3 py-2 bg-[var(--status-negative-surface)] border border-[var(--status-negative)] text-[var(--status-negative)] text-[13px] font-[var(--font-body)]">
            {describeError(params.error)}
          </div>
        )}

        {/* GitHub OAuth — Phase 2 of the auth migration */}
        <form action="/auth/github/start" method="get" className="space-y-3">
          <input type="hidden" name="next" value={params.next ?? "/dashboard"} />
          <SharpButton type="submit" variant="primary" className="w-full">
            Continue with GitHub
          </SharpButton>
        </form>

        <div className="text-center font-[var(--font-data)] text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)]">
          — or sign in with email —
        </div>

        <form
          action={async (formData: FormData) => {
            "use server"
            const email = String(formData.get("email") ?? "").trim()
            const result = await sendMagicLink(email)
            if (result.ok) {
              redirect(`/sign-in?sent=1&email=${encodeURIComponent(email)}`)
            } else {
              redirect(`/sign-in?error=${encodeURIComponent(result.error)}`)
            }
          }}
          className="space-y-3"
        >
          <SharpInput
            type="email"
            name="email"
            placeholder="you@email.com"
            required
            className="w-full"
          />
          <SharpButton type="submit" variant="secondary" className="w-full">
            Send sign-in link
          </SharpButton>
        </form>

        <p className="font-[var(--font-data)] text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)] text-center">
          No account needed — just your email.
        </p>
      </div>
    </main>
  )
}

function describeError(code: string): string {
  switch (code) {
    case "invalid_email":
      return "That doesn't look like a valid email."
    case "missing_token":
      return "The sign-in link was incomplete."
    case "invalid_token":
      return "The sign-in link is invalid or has expired."
    case "token_already_used":
      return "That sign-in link was already used. Request a new one below."
    case "token_expired":
      return "The sign-in link expired. Request a new one below."
    case "throttled":
      return "Too many sign-in attempts. Wait a minute and try again."
    case "email_send_timeout":
      return "Email service is slow right now. Please try again in a moment."
    case "email_send_failed":
      return "Couldn't send the email. Please try again."
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
