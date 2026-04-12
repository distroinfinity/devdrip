"use client"

import { terminalColors as tc } from "@/lib/design-tokens"

// vs code tab data
const TABS = [
  { name: "app.tsx", active: false },
  { name: "utils.ts", active: false },
  { name: "Dev Drip", active: true, icon: true },
]

const TRENDING = [
  { name: "Bun v1.2", desc: "2x faster test runner", tag: "RUNTIME" },
  { name: "Biome 2.0", desc: "Format + lint in one pass", tag: "TOOLING" },
]

export function CompanionTabDemo() {
  return (
    <div
      className="max-w-[560px] mx-auto rounded-lg overflow-hidden"
      style={{ background: tc.bg, border: `1px solid ${tc.border}` }}
    >
      {/* title bar */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderBottom: `1px solid ${tc.border}` }}
      >
        <div className="flex gap-1.5">
          <div className="w-[10px] h-[10px] rounded-full bg-[#FF5F57]" />
          <div className="w-[10px] h-[10px] rounded-full bg-[#FFBD2E]" />
          <div className="w-[10px] h-[10px] rounded-full bg-[#28C840]" />
        </div>
        <span className="font-body text-[10px] ml-2" style={{ color: tc.textTertiary }}>
          Visual Studio Code
        </span>
        <div className="flex-1" />
        <span
          className="font-data text-[9px] px-2 py-0.5 rounded"
          style={{ color: tc.textTertiary, background: `${tc.border}` }}
        >
          Agent Working...
        </span>
      </div>

      {/* tab bar */}
      <div
        className="flex overflow-x-auto no-visible-scrollbar"
        style={{ borderBottom: `1px solid ${tc.border}` }}
      >
        {TABS.map((tab) => (
          <div
            key={tab.name}
            className="flex items-center gap-1.5 px-3 py-1.5 shrink-0 font-data text-[11px]"
            style={{
              color: tab.active ? tc.text : tc.textTertiary,
              background: tab.active ? tc.bg : "transparent",
              borderBottom: tab.active ? `2px solid ${tc.text}` : "2px solid transparent",
            }}
          >
            {tab.icon && <span className="text-[var(--accent-color)]">&#x1F3AF;</span>}
            <span>{tab.name}</span>
          </div>
        ))}
      </div>

      {/* content area */}
      <div className="p-4">
        {/* sponsor card */}
        <div
          className="rounded-md p-4 mb-3"
          style={{
            background: tc.bgInset,
            border: `1px solid ${tc.border}`,
          }}
        >
          <div className="flex items-start justify-between mb-2">
            <div>
              <span
                className="font-body text-[9px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: tc.textTertiary }}
              >
                Sponsored
              </span>
              <h4 className="font-display text-[15px] font-bold mt-0.5" style={{ color: tc.text }}>
                Vercel Edge Functions
              </h4>
            </div>
            <span
              className="font-data text-data-xs font-bold"
              style={{ color: "var(--accent-color)" }}
            >
              +$0.03
            </span>
          </div>
          <p
            className="font-body text-[12px] leading-relaxed mb-3"
            style={{ color: tc.textSecondary }}
          >
            Deploy serverless functions to 30+ regions. Cold starts under 25ms.
          </p>

          {/* code snippet */}
          <div
            className="rounded p-2.5 mb-3 font-data text-[11px] leading-relaxed"
            style={{
              background: tc.bg,
              border: `1px solid ${tc.border}`,
              color: tc.textSecondary,
            }}
          >
            <div>
              <span style={{ color: "#C678DD" }}>export default</span>{" "}
              <span style={{ color: "#E5C07B" }}>function</span>{" "}
              <span style={{ color: "#61AFEF" }}>handler</span>
              <span style={{ color: tc.textTertiary }}>(req) {"{"}</span>
            </div>
            <div style={{ paddingLeft: 16 }}>
              <span style={{ color: "#C678DD" }}>return</span>{" "}
              <span style={{ color: "#98C379" }}>Response</span>
              <span style={{ color: tc.textTertiary }}>.json({"{ "}ok: </span>
              <span style={{ color: "#D19A66" }}>true</span>
              <span style={{ color: tc.textTertiary }}>{" }"})</span>
            </div>
            <div style={{ color: tc.textTertiary }}>{"}"}</div>
          </div>

          {/* action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              className="font-data text-[11px] font-medium px-3 py-1 rounded"
              style={{
                background: "var(--accent-color)",
                color: "#fff",
              }}
            >
              Try It
            </button>
            <button
              type="button"
              className="font-data text-[11px] px-3 py-1 rounded"
              style={{
                border: `1px solid ${tc.border}`,
                color: tc.textSecondary,
              }}
            >
              Skip
            </button>
          </div>
        </div>

        {/* also trending */}
        <div className="hidden md:block">
          <div
            className="font-body text-[9px] font-semibold uppercase tracking-[0.08em] mb-2"
            style={{ color: tc.textTertiary }}
          >
            Also Trending
          </div>
          <div className="flex gap-2">
            {TRENDING.map((item) => (
              <div
                key={item.name}
                className="flex-1 rounded p-2.5"
                style={{
                  background: tc.bgInset,
                  border: `1px solid ${tc.border}`,
                }}
              >
                <span
                  className="font-body text-[8px] font-semibold uppercase tracking-[0.06em]"
                  style={{ color: tc.textTertiary }}
                >
                  {item.tag}
                </span>
                <div
                  className="font-body text-[12px] font-medium mt-0.5"
                  style={{ color: tc.text }}
                >
                  {item.name}
                </div>
                <div className="font-body text-[10px] mt-0.5" style={{ color: tc.textSecondary }}>
                  {item.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
