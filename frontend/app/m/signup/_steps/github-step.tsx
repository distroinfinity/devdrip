"use client"

interface GithubStepProps {
  linkCode?: string
}

// The /start route bakes any active CLI-link code into the OAuth state token,
// so the post-callback redirect can land the user back on the LinkCliCard
// (rather than the wallet page). We forward `?link=` from the page URL here.
export function GithubStep({ linkCode }: GithubStepProps) {
  const href = linkCode
    ? `/api/miniapp/github-oauth/start?link=${encodeURIComponent(linkCode)}`
    : "/api/miniapp/github-oauth/start"
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] p-5">
      <p className="text-[var(--ink-secondary)]">
        Connect your GitHub account so we can attribute earnings to your developer identity.
      </p>
      <a
        href={href}
        className="rounded-md bg-[var(--accent-color)] px-4 py-3 text-center font-medium text-[var(--ink-inverse)]"
      >
        Connect GitHub
      </a>
    </div>
  )
}
