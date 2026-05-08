type Status = "green" | "amber" | "red"

const COLOR: Record<Status, string> = {
  green: "#2F8F4E",
  amber: "#B8860B",
  red: "#C13438",
}

export function StatusDot({ status, label }: { status: Status; label?: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        aria-label={`status ${status}`}
        style={{
          width: 6,
          height: 6,
          borderRadius: 999,
          backgroundColor: COLOR[status],
          boxShadow: `0 0 6px ${COLOR[status]}66`,
          display: "inline-block",
        }}
      />
      {label && (
        <span className="font-[var(--font-data)] text-[10px] text-[var(--ink-secondary)]">
          {label}
        </span>
      )}
    </span>
  )
}
