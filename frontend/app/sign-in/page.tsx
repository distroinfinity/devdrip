import { redirect } from "next/navigation"
import type { Metadata } from "next"
import { sendMagicLink } from "@/app/setup/actions"
import { getSession } from "@/lib/session"

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
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold">Check your email</h1>
          <p className="text-sm text-muted-foreground">
            We sent a sign-in link to <strong>{params.email}</strong>. Click the link to complete
            sign-in. The link expires in 15 minutes.
          </p>
          <p className="text-xs text-muted-foreground pt-4">
            Didn&apos;t get it?{" "}
            <a href="/sign-in" className="underline">
              Try again
            </a>
            .
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-semibold">Sign in to Distro TV</h1>
          <p className="mt-2 text-sm text-muted-foreground">Magic-link sign-in — no password.</p>
        </div>

        {params.error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 text-red-800 rounded text-sm">
            {describeError(params.error)}
          </div>
        )}

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
          <input
            type="email"
            name="email"
            placeholder="you@email.com"
            required
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
          />
          <button type="submit" className="w-full px-4 py-2 bg-black text-white rounded text-sm">
            Send sign-in link
          </button>
        </form>
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
    default:
      return `Something went wrong (${code}). Try again.`
  }
}
