// plain rectangles that pulse; used as Suspense fallbacks + initial load states

export function HeroSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-[var(--rule-subtle)] bg-[var(--bg-surface)] px-6 py-9 md:px-8">
      <div className="h-3 w-16 rounded-sm bg-[var(--bg-inset)]" />
      <div className="mt-4 h-12 w-52 rounded-sm bg-[var(--bg-inset)] md:h-16 md:w-72" />
      <div className="mt-3 h-3 w-40 rounded-sm bg-[var(--bg-inset)]" />
    </div>
  )
}

export function StatGridSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--rule-subtle)] bg-[var(--rule-subtle)] md:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-[var(--bg-surface)] px-5 py-5">
          <div className="h-3 w-16 rounded-sm bg-[var(--bg-inset)]" />
          <div className="mt-3 h-7 w-24 rounded-sm bg-[var(--bg-inset)]" />
          <div className="mt-2 h-3 w-20 rounded-sm bg-[var(--bg-inset)]" />
        </div>
      ))}
    </div>
  )
}

export function ChartSkeleton() {
  return (
    <div className="animate-pulse rounded-lg border border-[var(--rule-subtle)] bg-[var(--bg-surface)] px-4 pb-4 pt-5 md:px-6">
      <div className="h-3 w-24 rounded-sm bg-[var(--bg-inset)]" />
      <div className="mt-4 h-[200px] w-full rounded-sm bg-[var(--bg-inset)]/60 md:h-[260px]" />
    </div>
  )
}
