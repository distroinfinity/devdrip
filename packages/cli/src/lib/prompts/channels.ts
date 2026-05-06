import { multiselect, isCancel, cancel } from "@clack/prompts"
import type { ChannelDto } from "@distrotv/shared"

export async function pickChannels(current: ChannelDto[]): Promise<ChannelDto[]> {
  const initialKeys = current.filter((c) => c.subscribed).map((c) => c.key)
  const selected = await multiselect<string>({
    message: "which channels would you like in your slot rotation?",
    options: current.map((c) => ({
      value: c.key,
      label: c.label + (c.defaultOn ? " (default)" : ""),
    })),
    initialValues: initialKeys,
    required: false,
  })
  if (isCancel(selected)) {
    cancel("cancelled")
    process.exit(0)
  }
  const selectedSet = new Set(selected as string[])
  return current.map((c, idx) => ({
    ...c,
    subscribed: selectedSet.has(c.key),
    priority: selectedSet.has(c.key) ? idx : (c.priority ?? 0),
  }))
}
