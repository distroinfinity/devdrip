import { multiselect, isCancel, cancel } from "@clack/prompts"
import { FEEDS, type Feed } from "@distrotv/shared"

const LABELS: Record<Feed, { label: string; hint: string }> = {
  ads: { label: "Ads", hint: "sponsored slots — you earn an estimated 70% share" },
  news: { label: "News", hint: "CH 01 — top tech + finance stories" },
  markets: { label: "Markets", hint: "CH 02 — your watchlist" },
}

// what rotates in the terminal while the agent works. an empty pick is valid (everything off).
export async function pickFeeds(current: Feed[], only: Feed[] = FEEDS): Promise<Feed[]> {
  const selected = await multiselect<Feed>({
    message: "what plays while your agent works?  (space to toggle · enter to confirm)",
    options: only.map((f) => ({ value: f, label: LABELS[f].label, hint: LABELS[f].hint })),
    initialValues: current.filter((f) => only.includes(f)),
    required: false,
  })
  if (isCancel(selected)) {
    cancel("cancelled")
    process.exit(0)
  }
  const set = new Set(selected as Feed[])
  return FEEDS.filter((f) => set.has(f))
}
