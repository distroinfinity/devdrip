import { redirect } from "next/navigation"
import { exchangePairCode, sendMagicLink } from "./actions"
import { getSession, getPairCookie } from "@/lib/session"
import { SharpInput } from "@/components/v5/sharp-input"
import { SharpButton } from "@/components/v5/sharp-button"
import { SectionRule } from "@/components/v5/section-rule"

interface PageProps {
  searchParams: Promise<{ pair?: string; sent?: string; email?: string; error?: string }>
}

export default async function SetupPage({ searchParams }: PageProps) {
  const params = await searchParams
  const session = await getSession()

  // first arrival from CLI: pair code in URL → exchange + redirect to clean URL
  if (params.pair && !session) {
    const result = await exchangePairCode(params.pair)
    if (result.ok) {
      redirect("/setup")
    }
    return <SetupErrorState error={result.error} />
  }

  // email-sent confirmation
  if (params.sent === "1" && params.email) {
    return <CheckEmailState email={params.email} />
  }

  // authed (post-pair-exchange) but not signed in via email → show optional sign-in
  // params.pair is empty after the redirect from exchange; read pair from cookie instead
  if (session && !session.email) {
    const pair = await getPairCookie()
    return <ChooseSignInState pairingCode={pair ?? ""} error={params.error} />
  }

  // signed in via email → done state
  if (session?.email) {
    return <SignedInState email={session.email} />
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
            Your device is registered. Sign in with email to sync prefs across devices and access
            the dashboard, or skip and use anonymously.
          </p>
        </div>

        {error && (
          <div className="px-3 py-2 bg-[var(--status-negative-surface)] border border-[var(--status-negative)] text-[var(--status-negative)] text-[13px] font-[var(--font-body)]">
            {describeError(error)}
          </div>
        )}

        <form
          action={async (formData: FormData) => {
            "use server"
            const email = String(formData.get("email") ?? "").trim()
            const result = await sendMagicLink(email, pairingCode || undefined)
            if (result.ok) {
              redirect(`/setup?sent=1&email=${encodeURIComponent(email)}`)
            } else {
              redirect(`/setup?error=${encodeURIComponent(result.error)}`)
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
          <SharpButton type="submit" variant="primary" className="w-full">
            Send sign-in link
          </SharpButton>
        </form>

        <p className="text-[13px] font-[var(--font-body)] text-center text-[var(--ink-tertiary)]">
          You&apos;re already using Distro TV anonymously. Sign-in is optional but enables dashboard
          access.
        </p>

        <SectionRule />

        <p className="font-[var(--font-data)] text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)]">
          Need richer config? Channels + watchlist editing land in M3 + M4.
        </p>
      </div>
    </main>
  )
}

function CheckEmailState({ email }: { email: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[var(--bg-primary)]">
      <div className="max-w-md text-center space-y-3">
        <h1 className="font-[var(--font-display)] text-[22px] font-bold tracking-[-0.02em] text-[var(--ink-primary)]">
          Check your email
        </h1>
        <p className="text-[13px] font-[var(--font-body)] text-[var(--ink-secondary)]">
          We sent a sign-in link to <strong className="text-[var(--ink-primary)]">{email}</strong>.
          Click the link to complete sign-in. The link expires in 15 minutes.
        </p>
        <p className="font-[var(--font-data)] text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)] pt-4">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <a href="/setup" className="text-[var(--accent-color)] hover:underline">
            try again
          </a>
          .
        </p>
      </div>
    </main>
  )
}

function SignedInState({ email }: { email: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[var(--bg-primary)]">
      <div className="max-w-md text-center space-y-4">
        <h1 className="font-[var(--font-display)] text-[22px] font-bold tracking-[-0.02em] text-[var(--ink-primary)]">
          Signed in as {email}
        </h1>
        <p className="text-[13px] font-[var(--font-body)] text-[var(--ink-secondary)]">
          Your devices and prefs sync now.
        </p>
        <a
          href="/setup/channels"
          className="inline-block mt-4 px-4 py-2 text-[13px] font-medium font-[var(--font-body)] bg-[var(--ink-primary)] text-[var(--bg-primary)] hover:bg-[var(--em-hover)] transition-colors duration-150"
        >
          Continue
        </a>
      </div>
    </main>
  )
}

function SetupErrorState({ error }: { error: string }) {
  return (
    <main className="min-h-screen flex items-center justify-center p-8 bg-[var(--bg-primary)]">
      <div className="max-w-md text-center space-y-3">
        <h1 className="font-[var(--font-display)] text-[22px] font-bold tracking-[-0.02em] text-[var(--ink-primary)]">
          Setup error
        </h1>
        <p className="text-[13px] font-[var(--font-body)] text-[var(--ink-secondary)]">
          {describeError(error)}
        </p>
        <p className="font-[var(--font-data)] text-[10px] uppercase tracking-wider text-[var(--ink-tertiary)] pt-2">
          Try running <code className="font-[var(--font-data)]">distro init</code> again from your
          terminal.
        </p>
      </div>
    </main>
  )
}

function describeError(code: string): string {
  switch (code) {
    case "pair_code_unknown_or_expired":
      return "The pairing link expired. Pairing codes are valid for 10 minutes."
    case "device_not_found":
      return "The device this link belongs to has been deleted."
    case "throttled":
      return "Too many sign-in attempts. Wait a minute and try again."
    case "invalid_email":
      return "That doesn't look like a valid email."
    case "email_send_timeout":
      return "Email service is slow right now. Please try again in a moment."
    case "email_send_failed":
      return "Couldn't send the email. Please try again."
    case "network_error":
      return "Couldn't reach the server. Check your network and try again."
    default:
      return `Something went wrong (${code}).`
  }
}
