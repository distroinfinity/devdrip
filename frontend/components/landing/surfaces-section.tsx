"use client";

import { useState, useRef, useCallback, useEffect, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "motion/react";
import { tokens, terminalColors as tc } from "@/lib/design-tokens";
import { BlurFade } from "@/components/ui/blur-fade";
import { DotGrid } from "@/components/shared/dot-grid";
import { SurfaceInfoBar } from "./surfaces/surface-info-bar";
import {
  Monitor,
  PanelRight,
  AppWindow,
  Newspaper,
  Trophy,
  Volume2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// -- lazy-loaded demos --

const TerminalTVDemo = lazy(
  () => import("./surfaces/terminal-tv-demo").then((m) => ({ default: m.TerminalTVDemo }))
);
const CompanionTabDemo = lazy(
  () => import("./surfaces/companion-tab-demo").then((m) => ({ default: m.CompanionTabDemo }))
);
const IdleWidgetDemo = lazy(
  () => import("./surfaces/idle-widget-demo").then((m) => ({ default: m.IdleWidgetDemo }))
);
const MorningDigestDemo = lazy(
  () => import("./surfaces/morning-digest-demo").then((m) => ({ default: m.MorningDigestDemo }))
);
const SponsoredChallengeDemo = lazy(
  () => import("./surfaces/sponsored-challenge-demo").then((m) => ({ default: m.SponsoredChallengeDemo }))
);
const AudioCompanionDemo = lazy(
  () => import("./surfaces/audio-companion-demo").then((m) => ({ default: m.AudioCompanionDemo }))
);

// -- surface data --

interface SurfaceTab {
  id: string;
  label: string;
  icon: LucideIcon;
  earningRate: string;
  dismissMechanism: string;
  keyDetail: string;
  description: string;
}

const SURFACES: SurfaceTab[] = [
  {
    id: "terminal-tv",
    label: "Terminal TV",
    icon: Monitor,
    earningRate: "$0.02/view",
    dismissMechanism: "[S]kip  [D]iscover  [M]ute 30min",
    keyDetail: "Rendered in pure ANSI. Feels like it belongs.",
    description:
      "When your agent is thinking, a small bordered panel appears below the output. It shows a developer tool you might actually want to know about. Press S to skip. Press D to discover. Press M to mute for 30 minutes. It vanishes the instant you type.",
  },
  {
    id: "companion-tab",
    label: "Companion Tab",
    icon: PanelRight,
    earningRate: "$0.03/view",
    dismissMechanism: "Tab auto-closes on resume",
    keyDetail: "Opens alongside your code. Never steals focus.",
    description:
      "A new editor tab opens unfocused alongside your active file. Rich content — interactive demos, tool recommendations, sponsored tips. Your cursor stays in your code. The tab closes within 200ms when you start typing.",
  },
  {
    id: "idle-widget",
    label: "Idle Widget",
    icon: AppWindow,
    earningRate: "$0.02/view",
    dismissMechanism: "[Minimize] to pill",
    keyDetail: "Works across any IDE. Minimizes to a pill.",
    description:
      "A floating mini-player shows sponsor content alongside your agent's progress bar and earnings streak. Minimizes to a tiny pill showing your running total. Works with any tool — not tied to a specific IDE.",
  },
  {
    id: "morning-digest",
    label: "Morning Digest",
    icon: Newspaper,
    earningRate: "$0.01/view",
    dismissMechanism: "[Dismiss All]  [Show fewer]",
    keyDetail: "2–3 curated items at session start. That's it.",
    description:
      "When you open your IDE in the morning or return from a break, a brief digest shows 2–3 curated items — a tool launch, a coding tip, a role. Yesterday's earnings are right there. Dismiss all with one click.",
  },
  {
    id: "sponsored-challenge",
    label: "Challenge",
    icon: Trophy,
    earningRate: "$0.10/challenge",
    dismissMechanism: "[S]kip challenge",
    keyDetail: "Earn $0.10 while learning. Recruiters pay, you benefit.",
    description:
      "During longer agent tasks, an optional coding question appears. Answer correctly to earn a bonus. Challenges are genuinely educational — a MongoDB aggregation question teaches a real skill. Recruiters sponsor it, you learn and earn.",
  },
  {
    id: "audio-companion",
    label: "Audio",
    icon: Volume2,
    earningRate: "$0.02/listen",
    dismissMechanism: "Any keystroke mutes instantly",
    keyDetail: "Eyes stay on terminal. 15 seconds max.",
    description:
      "A short audio clip plays during agent work — a dev tip, a 15-second product pitch. Your eyes stay on the terminal output. Text transcript appears for accessibility. Any keystroke mutes it instantly.",
  },
];

// -- preload map for hover-triggered loading --

const preloadMap: Record<string, () => void> = {
  "terminal-tv": () => import("./surfaces/terminal-tv-demo"),
  "companion-tab": () => import("./surfaces/companion-tab-demo"),
  "idle-widget": () => import("./surfaces/idle-widget-demo"),
  "morning-digest": () => import("./surfaces/morning-digest-demo"),
  "sponsored-challenge": () => import("./surfaces/sponsored-challenge-demo"),
  "audio-companion": () => import("./surfaces/audio-companion-demo"),
};

// -- loading skeleton --

function DemoSkeleton() {
  return (
    <div
      className="min-h-[320px] rounded-lg flex items-center justify-center"
      style={{ background: tc.bg, border: `1px solid ${tc.border}` }}
    >
      <span
        className="font-data text-data-xs animate-pulse"
        style={{ color: tc.textTertiary }}
      >
        Loading...
      </span>
    </div>
  );
}

// -- demo renderer --

function DemoContent({ surfaceId }: { surfaceId: string }) {
  switch (surfaceId) {
    case "terminal-tv":
      return <TerminalTVDemo />;
    case "companion-tab":
      return <CompanionTabDemo />;
    case "idle-widget":
      return <IdleWidgetDemo />;
    case "morning-digest":
      return <MorningDigestDemo />;
    case "sponsored-challenge":
      return <SponsoredChallengeDemo />;
    case "audio-companion":
      return <AudioCompanionDemo />;
    default:
      return null;
  }
}

// -- main section --

export function SurfacesSection() {
  const [activeTab, setActiveTab] = useState(SURFACES[0].id);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // cleanup hover preload timer on unmount
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    };
  }, []);

  const activeSurface = SURFACES.find((s) => s.id === activeTab)!;

  const handleTabClick = useCallback((id: string) => {
    setActiveTab(id);

    // auto-scroll active tab into view on mobile
    const btn = document.getElementById(`surface-tab-${id}`);
    btn?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, []);

  const handleTabHover = useCallback((id: string) => {
    hoverTimerRef.current = setTimeout(() => preloadMap[id]?.(), 200);
  }, []);

  const handleTabLeave = useCallback(() => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  }, []);

  return (
    <section id="surfaces" className="relative overflow-hidden mx-auto max-w-grid px-6 py-20 scroll-mt-20">
      <DotGrid opacity={0.15} variant="static" />
      <div className="relative">
        {/* header */}
        <BlurFade inView delay={0}>
          <div className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.1em] mb-3">
            The Surfaces
          </div>
          <h2 className="font-display text-h2 md:text-h1 font-bold text-[var(--ink-primary)] mb-2">
            Six ways to earn. All optional.
          </h2>
          <p className="font-body text-body text-[var(--ink-secondary)] max-w-[600px] mb-10">
            Each surface is native to its environment. Monospace in the terminal.
            A tab in VS Code. A card at session start. You pick which ones run.
          </p>
        </BlurFade>

        {/* tab bar + content */}
        <BlurFade inView delay={0.1}>
          <div>
            {/* tab bar */}
            <div
              role="tablist"
              aria-label="Ad surface demos"
              className="flex overflow-x-auto no-visible-scrollbar gap-1 border-b border-[var(--rule-default)] mb-6"
              style={{ scrollSnapType: "x mandatory" }}
            >
              {SURFACES.map((surface) => {
                const isActive = activeTab === surface.id;
                const Icon = surface.icon;
                return (
                  <button
                    key={surface.id}
                    id={`surface-tab-${surface.id}`}
                    role="tab"
                    type="button"
                    aria-selected={isActive}
                    aria-controls={`surface-panel-${surface.id}`}
                    onClick={() => handleTabClick(surface.id)}
                    onMouseEnter={() => handleTabHover(surface.id)}
                    onMouseLeave={handleTabLeave}
                    className="relative flex items-center gap-1.5 px-3 py-2.5 font-body text-[12px] font-medium whitespace-nowrap transition-colors shrink-0"
                    style={{
                      scrollSnapAlign: "start",
                      color: isActive
                        ? "var(--ink-primary)"
                        : "var(--ink-tertiary)",
                    }}
                  >
                    <Icon size={14} strokeWidth={1.5} />
                    <span>{surface.label}</span>

                    {/* animated underline */}
                    {isActive && (
                      <motion.div
                        layoutId="surface-tab-underline"
                        className="absolute bottom-0 left-0 right-0 h-[2px] bg-[var(--ink-primary)]"
                        transition={{
                          type: "spring",
                          bounce: 0.2,
                          duration: 0.5,
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* demo content area */}
            <div
              id={`surface-panel-${activeTab}`}
              role="tabpanel"
              aria-labelledby={`surface-tab-${activeTab}`}
              className="min-h-[320px]"
            >
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{
                    duration: tokens.timing.smooth / 1000,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                >
                  <Suspense fallback={<DemoSkeleton />}>
                    <DemoContent surfaceId={activeTab} />
                  </Suspense>
                  <SurfaceInfoBar
                    earning={activeSurface.earningRate}
                    dismiss={activeSurface.dismissMechanism}
                    detail={activeSurface.keyDetail}
                    description={activeSurface.description}
                  />
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </BlurFade>

        {/* trust strip */}
        <BlurFade inView delay={0.2}>
          <div className="mt-12 pt-6 border-t border-[var(--rule-default)] flex flex-wrap justify-center gap-x-6 gap-y-2">
            {[
              "Every surface is opt-in individually",
              "Content matches environment",
              "One-keypress dismiss on all surfaces",
            ].map((item) => (
              <span
                key={item}
                className="font-body text-[11px] text-[var(--ink-tertiary)]"
              >
                {item}
              </span>
            ))}
          </div>
        </BlurFade>
      </div>
    </section>
  );
}
