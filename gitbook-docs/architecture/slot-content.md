# Slot Content

`SlotContent` is the daemon's content envelope. Discriminated union, future-proofed for additional content types.

```ts
type SlotContent = NewsSlot | TickerSlot

interface NewsSlot {
  kind: "news"
  payload: NewsPayload
}
interface TickerSlot {
  kind: "ticker"
  payload: TickerPayload
}
```

Defined in `packages/shared/src/types/index.ts`.

## Adding a new content type

1. Add a variant to the union (e.g. `interface PuzzleSlot { kind: "puzzle"; payload: PuzzlePayload }`)
2. Add a render branch in `packages/cli/src/lib/daemon/display.ts`
3. The daemon's `showSlot` function uses an exhaustiveness check (`never` assertion) — TypeScript fails the build until the branch is added

The orchestrator stays agnostic: `pickNextSlot` returns whatever the cache holds; slot-kind side effects (impressions, reading-list saves) are gated on `slot.kind`.

## Future variants under discussion

- sponsored news (native ads in the news feed, separate revenue share)
- puzzles / micro-challenges
- community announcements

## Related

- [Channel Modes](channel-modes.md)
