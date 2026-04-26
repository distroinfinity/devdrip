# Slot Content

`SlotContent` is the daemon's content envelope. Discriminated union, future-proofed for additional content types.

```ts
type SlotContent = AdSlot | NewsSlot

interface AdSlot {
  kind: "ad"
  payload: ServedAdPayload
}
interface NewsSlot {
  kind: "news"
  payload: NewsPayload
}
```

Defined in `packages/shared/src/types/index.ts`.

## Adding a new content type

1. Add a variant to the union (e.g. `interface PuzzleSlot { kind: "puzzle"; payload: PuzzlePayload }`)
2. Add a render branch in `packages/cli/src/lib/daemon/display.ts`
3. The daemon's `showSlot` function uses an exhaustiveness check (`never` assertion) — TypeScript fails the build until the branch is added

The orchestrator stays agnostic: `pickNextSlot` returns whatever the cache holds; ad-only side effects (campaign cap, hourly/daily caps, earnings ledger) are gated on `slot.kind === "ad"`.

## Future variants under discussion

- Sponsored news (native ads in the news feed, separate revenue share)
- Devlog snippets (DevDrip-original short-form content)
- Puzzles / micro-challenges

## Related

- [Channel Modes](channel-modes.md)
