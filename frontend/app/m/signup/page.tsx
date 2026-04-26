import { headers } from "next/headers"
import { fetchMiniAppMe } from "@/lib/miniapp-api"
import { MiniAppShell } from "../_components/mini-app-shell"
import { WalletAuthStep } from "./_steps/wallet-auth-step"
import { WorldIdStep } from "./_steps/world-id-step"
import { GithubStep } from "./_steps/github-step"
import { CompleteStep } from "./_steps/complete-step"

interface SignupPageProps {
  searchParams: { link?: string; step?: string }
}

// Server component — reads /miniapp/me to decide which step to render.
// On first visit (no cookie), me is null → show step 1 (walletAuth) which sets
// the cookie via /miniapp/wallet-auth/verify.
//
// `?link=ABC-123` query (from CLI QR scan) is threaded through to the final
// step so the user gets a "Link CLI?" prompt instead of being dumped on /m/wallet.
//
// `?step=done` query (from GitHub OAuth callback) routes directly to the
// complete step regardless of `me.signedUpAt` — this handles the brief window
// between GitHub callback redirecting back and the cookie reflecting the
// updated state.
export default async function SignupPage({ searchParams }: SignupPageProps) {
  const h = headers()
  const cookieHeader = h.get("cookie") ?? ""
  const proto = h.get("x-forwarded-proto") ?? "http"
  const host = h.get("host") ?? "localhost:3000"
  const origin = `${proto}://${host}`

  const me = await fetchMiniAppMe({ cookieHeader, origin }).catch(() => null)
  const linkCode = searchParams.link
  const stepDone = searchParams.step === "done"

  if (stepDone || me?.signedUpAt) {
    return (
      <MiniAppShell title="Welcome">
        <CompleteStep linkCode={linkCode} />
      </MiniAppShell>
    )
  }

  if (!me?.walletAddress) {
    return (
      <MiniAppShell title="Sign up — step 1 of 3">
        <WalletAuthStep />
      </MiniAppShell>
    )
  }

  if (!me.nullifierHash) {
    return (
      <MiniAppShell title="Sign up — step 2 of 3">
        <WorldIdStep />
      </MiniAppShell>
    )
  }

  if (!me.githubLogin) {
    return (
      <MiniAppShell title="Sign up — step 3 of 3">
        <GithubStep />
      </MiniAppShell>
    )
  }

  // All three credentials bound but signedUpAt not flipped — finalize.
  return (
    <MiniAppShell title="Welcome">
      <CompleteStep linkCode={linkCode} />
    </MiniAppShell>
  )
}
