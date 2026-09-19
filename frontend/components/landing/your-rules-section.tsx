"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { BlurFade } from "@/components/ui/blur-fade";
import { DotGrid } from "@/components/shared/dot-grid";

// --- data ---

const SURFACES = [
  { key: "terminalTv", label: "Terminal TV" },
  { key: "companionTab", label: "Companion Tab" },
  { key: "challenges", label: "Challenges" },
  { key: "audio", label: "Audio" },
  { key: "widget", label: "Widget" },
  { key: "digest", label: "Digest" },
] as const;

type SurfaceKey = (typeof SURFACES)[number]["key"];

const SURFACE_DEFAULTS: Record<SurfaceKey, boolean> = {
  terminalTv: true,
  companionTab: true,
  challenges: true,
  audio: false,
  widget: true,
  digest: true,
};

const CATEGORIES = [
  { key: "devTools", label: "Dev tools" },
  { key: "infrastructure", label: "Infrastructure" },
  { key: "databases", label: "Databases" },
  { key: "recruiting", label: "Recruiting" },
  { key: "education", label: "Education" },
  { key: "openSource", label: "Open source" },
] as const;

type CategoryKey = (typeof CATEGORIES)[number]["key"];

const CATEGORY_DEFAULTS: Record<CategoryKey, boolean> = {
  devTools: true,
  infrastructure: true,
  databases: true,
  recruiting: false,
  education: false,
  openSource: true,
};

const NEVER_ITEMS = [
  "show content during active coding",
  "auto-play video with sound",
  "block you from working",
  "analyze your code for targeting",
  "create a speculative token",
  "show competitor ads for your current tools",
  "degrade the ad-free experience",
  "exceed your frequency preferences",
];

const HOURS = Array.from({ length: 24 }, (_, i) => {
  const period = i < 12 ? "AM" : "PM";
  const hour = i === 0 ? 12 : i > 12 ? i - 12 : i;
  return { value: `${String(i).padStart(2, "0")}:00`, label: `${hour}:00 ${period}` };
});

// --- sub-components ---

function SurfaceToggle({
  label,
  enabled,
  onToggle,
}: {
  label: string;
  enabled: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="font-body text-body-s text-[var(--ink-primary)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        onClick={onToggle}
        className={cn(
          "relative w-9 h-5 rounded-full transition-colors duration-200 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-primary)] focus-visible:ring-offset-2",
          enabled ? "bg-[var(--ink-primary)]" : "bg-[var(--rule-default)]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200",
            enabled && "translate-x-4",
          )}
        />
      </button>
    </div>
  );
}

function RangeControl({
  label,
  min,
  max,
  value,
  onChange,
  formatValue,
}: {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (v: number) => void;
  formatValue: (v: number) => string;
}) {
  // fill percentage for the track gradient
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="py-2.5">
      <div className="flex items-center justify-between mb-2">
        <span className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.1em]">
          {label}
        </span>
        <span className="font-data text-data-s font-bold text-[var(--ink-primary)]">
          {formatValue(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={cn(
          "w-full h-1 rounded-full appearance-none cursor-pointer outline-none",
          // webkit thumb
          "[&::-webkit-slider-thumb]:appearance-none",
          "[&::-webkit-slider-thumb]:w-3.5",
          "[&::-webkit-slider-thumb]:h-3.5",
          "[&::-webkit-slider-thumb]:rounded-full",
          "[&::-webkit-slider-thumb]:bg-[var(--ink-primary)]",
          "[&::-webkit-slider-thumb]:cursor-pointer",
          "[&::-webkit-slider-thumb]:transition-transform",
          "[&::-webkit-slider-thumb]:duration-150",
          "[&::-webkit-slider-thumb]:hover:scale-125",
          // firefox thumb
          "[&::-moz-range-thumb]:border-0",
          "[&::-moz-range-thumb]:w-3.5",
          "[&::-moz-range-thumb]:h-3.5",
          "[&::-moz-range-thumb]:rounded-full",
          "[&::-moz-range-thumb]:bg-[var(--ink-primary)]",
          "[&::-moz-range-thumb]:cursor-pointer",
          // firefox track
          "[&::-moz-range-track]:h-1",
          "[&::-moz-range-track]:rounded-full",
          "[&::-moz-range-track]:bg-transparent",
        )}
        style={{
          background: `linear-gradient(to right, var(--ink-tertiary) 0%, var(--ink-tertiary) ${pct}%, var(--rule-default) ${pct}%, var(--rule-default) 100%)`,
        }}
      />
    </div>
  );
}

function ScheduleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span className="font-body text-body-s text-[var(--ink-secondary)] shrink-0">
        {label}
      </span>
      <select
        value={value}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "font-data text-data-s text-[var(--ink-primary)]",
          "bg-transparent border-b border-[var(--rule-default)]",
          "pb-0.5 pr-1 cursor-pointer outline-none",
          "focus:border-[var(--ink-primary)] transition-colors",
        )}
      >
        {HOURS.map((h) => (
          <option
            key={h.value}
            value={h.value}
            className="bg-[var(--bg-surface)] text-[var(--ink-primary)]"
          >
            {h.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function CategoryCheckbox({
  label,
  checked,
  onToggle,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      className="flex items-center gap-2.5 cursor-pointer py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink-primary)] focus-visible:ring-offset-2 rounded-sm"
    >
      <span
        className={cn(
          "w-4 h-4 rounded-sm border flex items-center justify-center transition-colors duration-150 shrink-0",
          checked
            ? "bg-[var(--ink-primary)] border-[var(--ink-primary)]"
            : "bg-transparent border-[var(--rule-strong)]",
        )}
      >
        {checked && (
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path
              d="M2 5L4.5 7.5L8 3"
              stroke="var(--bg-surface)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <span className="font-body text-body-s text-[var(--ink-secondary)]">{label}</span>
    </button>
  );
}

// --- control panel ---

function ControlPanel() {
  const [surfaces, setSurfaces] = useState(SURFACE_DEFAULTS);
  const [frequency, setFrequency] = useState(20);
  const [idleSensitivity, setIdleSensitivity] = useState(5);
  const [scheduleStart, setScheduleStart] = useState("09:00");
  const [scheduleEnd, setScheduleEnd] = useState("23:00");
  const [categories, setCategories] = useState(CATEGORY_DEFAULTS);

  const toggleSurface = (key: SurfaceKey) =>
    setSurfaces((s) => ({ ...s, [key]: !s[key] }));

  const toggleCategory = (key: CategoryKey) =>
    setCategories((c) => ({ ...c, [key]: !c[key] }));

  return (
    <div className="relative rounded-md border border-[var(--rule-default)] bg-[var(--bg-surface)] overflow-hidden">
      <DotGrid opacity={0.1} variant="static" />

      <div className="relative p-4 lg:p-5">
        {/* surfaces */}
        <div className="mb-1">
          <div className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.1em] mb-1">
            Surfaces
          </div>
          <div className="divide-y divide-[var(--rule-subtle)]">
            {SURFACES.map((s) => (
              <SurfaceToggle
                key={s.key}
                label={s.label}
                enabled={surfaces[s.key]}
                onToggle={() => toggleSurface(s.key)}
              />
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--rule-default)] my-1" />

        {/* frequency */}
        <RangeControl
          label="Frequency"
          min={5}
          max={60}
          value={frequency}
          onChange={setFrequency}
          formatValue={(v) => `${v}/day`}
        />

        {/* idle sensitivity */}
        <RangeControl
          label="Idle Sensitivity"
          min={3}
          max={15}
          value={idleSensitivity}
          onChange={setIdleSensitivity}
          formatValue={(v) => `${v}s`}
        />

        <div className="border-t border-[var(--rule-default)] my-1" />

        {/* schedule */}
        <div className="py-2">
          <div className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.1em] mb-2">
            Schedule
          </div>
          <ScheduleRow
            label="No content before"
            value={scheduleStart}
            onChange={setScheduleStart}
          />
          <ScheduleRow
            label="No content after"
            value={scheduleEnd}
            onChange={setScheduleEnd}
          />
        </div>

        <div className="border-t border-[var(--rule-default)] my-1" />

        {/* categories */}
        <div className="py-2">
          <div className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.1em] mb-3">
            Categories
          </div>
          <div className="grid grid-cols-3 gap-x-3 gap-y-1">
            {CATEGORIES.map((c) => (
              <CategoryCheckbox
                key={c.key}
                label={c.label}
                checked={categories[c.key]}
                onToggle={() => toggleCategory(c.key)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- never list ---

function NeverList() {
  return (
    <div className="mt-10">
      {NEVER_ITEMS.map((item, i) => (
        <BlurFade key={item} inView delay={0.05 + i * 0.1}>
          <div
            className={cn(
              "flex items-start gap-4 py-4",
              i < NEVER_ITEMS.length - 1 && "border-b border-[var(--rule-subtle)]",
            )}
          >
            <span className="font-display text-[13px] font-bold text-[var(--ink-primary)] tracking-[0.06em] uppercase shrink-0 mt-0.5">
              Never
            </span>
            <span className="font-body text-body-s text-[var(--ink-secondary)] leading-relaxed">
              {item}
            </span>
          </div>
        </BlurFade>
      ))}
    </div>
  );
}

// --- section ---

export function YourRulesSection() {
  return (
    <section
      id="your-rules"
      aria-labelledby="your-rules-heading"
      className="relative bg-[var(--bg-secondary)] overflow-hidden scroll-mt-20"
    >
      <DotGrid opacity={0.18} variant="heartbeat" />

      <div className="relative mx-auto max-w-grid px-6 py-20">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* left — heading + copy + never list */}
          <div>
            <BlurFade inView delay={0}>
              <div className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.1em] mb-3">
                Your Rules
              </div>
              <h2
                id="your-rules-heading"
                className="font-display text-h2 md:text-h1 font-bold text-[var(--ink-primary)] tracking-[-0.02em] mb-6"
              >
                You configure everything.
              </h2>
            </BlurFade>

            <BlurFade inView delay={0.1}>
              <p className="font-body text-body text-[var(--ink-secondary)] leading-[1.6] mb-2">
                Surfaces, frequency, categories, schedule. If you say 5 per day, that&apos;s the ceiling.
              </p>
            </BlurFade>

            <NeverList />
          </div>

          {/* right — control panel, aligned with heading */}
          <BlurFade inView delay={0.2}>
            <ControlPanel />
          </BlurFade>
        </div>
      </div>
    </section>
  );
}
