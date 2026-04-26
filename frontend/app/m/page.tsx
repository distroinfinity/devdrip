import { redirect } from "next/navigation"
import { cookies } from "next/headers"

// Mini App entry point. Inside World App, MiniKit is installed (gated by the
// layout) and we route based on whether the user already has a session.
//
// Server-side check: presence of dd_miniapp cookie. We don't decode it here
// (the layout already gated MiniKit installation); we just choose the next
// page. /m/signup will re-check `signedUpAt` and either render the wizard
// or redirect onward to /m/wallet.
export default function MiniAppHome() {
  const hasSession = cookies().has("dd_miniapp")
  redirect(hasSession ? "/m/wallet" : "/m/signup")
}
