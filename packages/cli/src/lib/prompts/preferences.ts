import { select, isCancel, cancel } from "@clack/prompts"
import { ChannelMode } from "@distrotv/shared"

// select prompt for channel mode. order: news → markets → mix, default mix.
export async function pickChannelMode(current?: ChannelMode): Promise<ChannelMode> {
  const initialValue = current ?? ChannelMode.Balanced
  const choice = await select<ChannelMode>({
    message: "pick a channel mode",
    options: [
      {
        value: ChannelMode.NewsOnly,
        label: "news only — every slot is news (HN, TechCrunch, Bloomberg)",
      },
      { value: ChannelMode.NewsHeavy, label: "news heavy — 3:1 news to ticker" },
      { value: ChannelMode.Balanced, label: "balanced — 1:1 news + ticker (recommended)" },
      { value: ChannelMode.TickerHeavy, label: "ticker heavy — 1:3 news to ticker" },
      { value: ChannelMode.TickerOnly, label: "ticker only — every slot is a watchlist ticker" },
    ],
    initialValue,
  })
  if (isCancel(choice)) {
    cancel("cancelled")
    process.exit(0)
  }
  return choice as ChannelMode
}
