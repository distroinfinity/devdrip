import { multiselect, isCancel, cancel } from "@clack/prompts"
import type { ChannelDto, ChannelKey } from "@distrotv/shared"

// Returns the subscribed channel keys in display-list order. The caller hands
// this array to putMyChannels; the server assigns priority from the array index.
// (Display-list order is alphabetical until drag-reorder lands; that's fine —
// it preserves the seed defaults of tech=0, finance=1.)
export async function pickChannels(current: ChannelDto[]): Promise<ChannelKey[]> {
  const initialKeys = current.filter((c) => c.subscribed).map((c) => c.key)
  const selected = await multiselect<ChannelKey>({
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
  // preserve catalog order (alphabetical) so priority is stable across edits
  const selectedSet = new Set(selected as ChannelKey[])
  return current.filter((c) => selectedSet.has(c.key)).map((c) => c.key)
}
