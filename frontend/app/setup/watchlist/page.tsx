import { redirect } from "next/navigation"
import { getSession } from "@/lib/session"
import { WatchlistClient } from "./watchlist-client"

export default async function SetupWatchlistPage() {
  const session = await getSession()
  if (!session) redirect("/setup")

  return (
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Pick your tickers</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            These appear in your terminal slot when mode is markets or mix. You can change this
            anytime.
          </p>
        </div>
        <WatchlistClient />
      </div>
    </main>
  )
}
