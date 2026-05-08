import type { ReactNode } from "react"

interface Props {
  title: string
  body?: string
  action?: ReactNode
}

export function EmptyState({ title, body, action }: Props) {
  return (
    <div className="py-16 text-center">
      <h3 className="font-[var(--font-display)] text-[15px] font-bold tracking-[-0.02em] text-[var(--ink-primary)]">
        {title}
      </h3>
      {body && (
        <p className="mt-2 text-[13px] text-[var(--ink-secondary)] max-w-md mx-auto">{body}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}
