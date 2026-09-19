import { select, isCancel, cancel } from "@clack/prompts"
import { ChannelMode } from "@distrotv/shared"

// select prompt for channel mode. order: news → markets → mix, default mix.
export async function pickChannelMode(current?: ChannelMode): Promise<ChannelMode> {
  const initialValue = current ?? ChannelMode.Mix
  const choice = await select<ChannelMode>({
    message: "pick a channel mode",
    options: [
      { value: ChannelMode.News, label: "news — every slot is news (HN, TechCrunch, Bloomberg)" },
      { value: ChannelMode.Markets, label: "markets — every slot is a watchlist ticker (M4)" },
      { value: ChannelMode.Mix, label: "mix — alternates news + markets (recommended)" },
    ],
    initialValue,
  })
  if (isCancel(choice)) {
    cancel("cancelled")
    process.exit(0)
  }
  return choice as ChannelMode
}
