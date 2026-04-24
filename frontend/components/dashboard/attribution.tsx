import { HeartPixel } from "@devdrip/design-system/components/heart-pixel"

export function Attribution() {
  return (
    <span className="font-data text-[10px] text-[var(--ink-faint)]">
      built with <HeartPixel /> by{" "}
      <a
        href="https://x.com/distroinfinity"
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--ink-tertiary)] underline underline-offset-2 transition-colors hover:text-[var(--ink-primary)]"
      >
        manu
      </a>
    </span>
  )
}
