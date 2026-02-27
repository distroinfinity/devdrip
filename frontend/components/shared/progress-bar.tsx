import { cn } from "@/lib/utils";

interface ProgressBarProps {
  label: string;
  current: number;
  total: number;
  className?: string;
}

export function ProgressBar({
  label,
  current,
  total,
  className,
}: ProgressBarProps) {
  const percentage = Math.min((current / total) * 100, 100);

  return (
    <div
      className={cn(
        "bg-[var(--bg-surface)] border border-[var(--rule-default)] rounded-md p-5",
        className,
      )}
    >
      <div className="flex justify-between items-baseline mb-2">
        <span className="font-body text-body-s font-medium text-[var(--ink-primary)]">
          {label}
        </span>
        <span className="font-data text-[13px] font-semibold text-[var(--ink-primary)]">
          ${current.toFixed(2)} / ${total.toFixed(2)}
        </span>
      </div>
      <div className="h-1 bg-[var(--bg-inset)] rounded-pill overflow-hidden">
        <div
          className="h-full bg-[var(--ink-primary)] rounded-pill"
          style={{ width: `${percentage}%`, transition: "width 600ms ease-out" }}
        />
      </div>
      <div className="font-data text-data-xs text-[var(--ink-tertiary)] mt-1.5">
        {percentage.toFixed(1)}% covered this month
      </div>
    </div>
  );
}
