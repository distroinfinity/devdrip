import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign in — Distro TV",
  robots: { index: false, follow: false },
}

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-semibold">Sign in</h1>
        <p className="text-sm text-muted-foreground">magic-link sign-in lands in M2.</p>
      </div>
    </main>
  )
}
