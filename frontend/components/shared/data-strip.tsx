import { cn } from "@/lib/utils";

interface DataPoint {
  label: string;
  value: string;
}

interface DataStripProps {
  data: DataPoint[];
  separator?: "rule" | "spacing";
  className?: string;
}

export function DataStrip({
  data,
  separator = "spacing",
  className,
}: DataStripProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap gap-8",
        separator === "rule" && "gap-0",
        className,
      )}
    >
      {data.map((point, i) => (
        <div key={i} className="flex items-center">
          {separator === "rule" && i > 0 && (
            <div className="w-px h-8 bg-[var(--rule-default)] mx-6 shrink-0" />
          )}
          <div>
            <div className="font-body text-[9px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.08em] mb-1">
              {point.label}
            </div>
            <div className="font-data text-[18px] font-bold text-[var(--ink-primary)]">
              {point.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
