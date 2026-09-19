"use client"

export function GithubStep() {
  // GitHub OAuth opens in the World App's in-app browser. Server-side at
  // /api/miniapp/github-oauth/start, the route mints state, redirects to GitHub,
  // and the callback eventually lands back on /m/signup?step=done.
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[var(--ink-secondary)]">
        Connect your GitHub account so we can attribute earnings to your developer identity.
      </p>
      <a
        href="/api/miniapp/github-oauth/start"
        className="rounded-md bg-[var(--accent)] px-4 py-3 text-center font-medium text-[var(--bg-primary)]"
      >
        Connect GitHub
      </a>
    </div>
  )
}
