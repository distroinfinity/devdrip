export interface Debounced {
  poke(): void
  cancel(): void
}

// run `fn` once things go quiet for `waitMs`, but never later than `maxWaitMs`
// after the first poke. timers are unref'd so they never hold the daemon open.
export function createDebounced(fn: () => void, waitMs: number, maxWaitMs = waitMs * 3): Debounced {
  let timer: ReturnType<typeof setTimeout> | null = null
  let firstPokeAt: number | null = null

  function fire(): void {
    timer = null
    firstPokeAt = null
    fn()
  }

  return {
    poke() {
      const now = Date.now()
      if (firstPokeAt === null) firstPokeAt = now
      if (timer) clearTimeout(timer)
      const remainingMax = Math.max(0, maxWaitMs - (now - firstPokeAt))
      timer = setTimeout(fire, Math.min(waitMs, remainingMax))
      timer.unref?.()
    },
    cancel() {
      if (timer) clearTimeout(timer)
      timer = null
      firstPokeAt = null
    },
  }
}
