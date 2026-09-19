interface SurfaceInfoBarProps {
  earning: string;
  dismiss: string;
  detail: string;
  description?: string;
}

export function SurfaceInfoBar({ earning, dismiss, detail, description }: SurfaceInfoBarProps) {
  return (
    <div className="mt-4 pt-4 border-t border-[var(--rule-default)]">
      <p className="font-body text-body-s text-[var(--ink-secondary)] mb-1 leading-relaxed italic">
        {detail}
      </p>
      {description && (
        <p className="font-body text-[12px] text-[var(--ink-tertiary)] mb-3 leading-relaxed">
          {description}
        </p>
      )}
      <div className="flex flex-wrap gap-6">
        <div>
          <div className="font-body text-[9px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.08em] mb-1">
            Earning Rate
          </div>
          <div className="font-data text-data-s font-bold text-[var(--ink-primary)]">
            {earning}
          </div>
        </div>
        <div>
          <div className="font-body text-[9px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.08em] mb-1">
            Dismiss
          </div>
          <div className="font-data text-data-xs text-[var(--ink-secondary)]">
            {dismiss}
          </div>
        </div>
      </div>
    </div>
  );
}
