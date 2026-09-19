"use client";

import { useRef, useEffect, useState, type RefObject, type Ref, type FC } from "react";
import { BlurFade } from "@/components/ui/blur-fade";
import { AnimatedBeam } from "@/components/ui/animated-beam";
import { DotGrid } from "@/components/shared/dot-grid";
import { DataStrip } from "@/components/shared/data-strip";
import { cn } from "@/lib/utils";

// --- data ---

const RAIL_METRICS = [
  { label: "fee per tx", value: "$0.002" },
  { label: "min payout", value: "$1.00" },
  { label: "settlement", value: "instant" },
];

const TRUST_FACTS = [
  "Cash out to your bank anytime",
  "Real-time balance in dashboard + CLI",
  "No token, no speculation — just dollars",
] as const;

// --- brand logos (inline SVG, currentColor) ---

function BaseLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2Zm0 15.556a5.556 5.556 0 1 1 0-11.112v5.556h5.556A5.556 5.556 0 0 1 12 17.556Z" />
    </svg>
  );
}

function StripeLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <path d="M13.479 9.883c0-1.04.47-1.81 1.37-1.81.86 0 1.31.73 1.31 1.77 0 1.87-1.01 2.89-2.13 2.89-.37 0-.73-.09-.98-.24l.02-2.16.42-.46Zm-3.05 3.56c0 .56.19.95.66 1.2.43.24 1.06.36 1.84.36 2.74 0 4.7-1.86 4.7-4.56 0-2.28-1.39-3.76-3.54-3.76-.8 0-1.5.21-2.01.53V4.5L10.43 5v8.06l.02.03-.04.34ZM7.1 13.98c.94 0 1.6-.2 2.13-.56l-.42-.98c-.4.22-.85.35-1.48.35-.92 0-1.44-.51-1.44-1.4 0-.84.56-1.42 1.38-1.42.5 0 .94.13 1.34.37l.42-1.02c-.52-.31-1.18-.48-1.86-.48-1.7 0-2.88 1.1-2.88 2.62 0 1.56 1.06 2.52 2.81 2.52Z" />
    </svg>
  );
}

function PayPalLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <path d="M7.076 21.337H5.47a.641.641 0 0 1-.633-.74L7.128 5.16a.768.768 0 0 1 .758-.648h4.734c1.573 0 2.756.395 3.515 1.173.636.652.954 1.56.945 2.699-.032 3.014-2.112 4.646-5.2 4.646h-1.31a.768.768 0 0 0-.758.648l-.836 5.446a.64.64 0 0 1-.633.54l-1.267.313ZM15.867 5.754c.058.64-.005 1.37-.2 2.18-.78 3.244-3.123 4.345-5.8 4.345h-.467l-.91 5.756h2.196l.75-4.787h1.297c3.08 0 5.39-1.725 5.9-4.98.238-1.513-.03-2.7-.766-3.514Z" />
    </svg>
  );
}

function UpiLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={cn("w-6 h-6", className)}
      aria-hidden="true"
    >
      <path d="M5.5 4h3.2l5.3 8.5V4H17v16h-3l-5.5-8.8V20H5.5V4Z" />
    </svg>
  );
}

// --- static dashed beam (mirrors AnimatedBeam's ref-measurement logic) ---

interface StaticDashedBeamProps {
  containerRef: RefObject<HTMLElement | null>;
  fromRef: RefObject<HTMLElement | null>;
  toRef: RefObject<HTMLElement | null>;
  curvature?: number;
  startXOffset?: number;
  startYOffset?: number;
  endXOffset?: number;
  endYOffset?: number;
  className?: string;
}

function StaticDashedBeam({
  containerRef,
  fromRef,
  toRef,
  curvature = 0,
  startXOffset = 0,
  startYOffset = 0,
  endXOffset = 0,
  endYOffset = 0,
  className,
}: StaticDashedBeamProps) {
  const [pathD, setPathD] = useState("");
  const [dims, setDims] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const update = () => {
      if (!containerRef.current || !fromRef.current || !toRef.current) return;
      const cr = containerRef.current.getBoundingClientRect();
      const fr = fromRef.current.getBoundingClientRect();
      const tr = toRef.current.getBoundingClientRect();

      setDims({ width: cr.width, height: cr.height });

      const sx = fr.left - cr.left + fr.width / 2 + startXOffset;
      const sy = fr.top - cr.top + fr.height / 2 + startYOffset;
      const ex = tr.left - cr.left + tr.width / 2 + endXOffset;
      const ey = tr.top - cr.top + tr.height / 2 + endYOffset;
      const cy = sy - curvature;

      setPathD(`M ${sx},${sy} Q ${(sx + ex) / 2},${cy} ${ex},${ey}`);
    };

    const ro = new ResizeObserver(update);
    if (containerRef.current) ro.observe(containerRef.current);
    update();
    return () => ro.disconnect();
  }, [containerRef, fromRef, toRef, curvature, startXOffset, startYOffset, endXOffset, endYOffset]);

  return (
    <svg
      fill="none"
      width={dims.width}
      height={dims.height}
      viewBox={`0 0 ${dims.width} ${dims.height}`}
      className={cn("pointer-events-none absolute top-0 left-0", className)}
    >
      <path
        d={pathD}
        stroke="var(--ink-faint)"
        strokeWidth={2}
        strokeOpacity={0.25}
        strokeDasharray="8 5"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

// --- hub node (Dev Drip platform) ---

const nodeBase =
  "rounded-md border bg-[var(--bg-surface)] flex items-center";

function HubNode({ nodeRef }: { nodeRef?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={nodeRef}
      className={cn(nodeBase, "border-[var(--rule-default)] px-6 py-5 gap-4")}
    >
      <div className="w-12 h-12 rounded-full bg-[var(--bg-inset)] flex items-center justify-center shrink-0">
        <span className="font-display text-[22px] font-bold text-[var(--ink-primary)] leading-none">
          DD
        </span>
      </div>
      <div>
        <div className="font-body text-[16px] font-semibold text-[var(--ink-primary)] leading-tight">
          Dev Drip
        </div>
        <div className="font-body text-[10px] text-[var(--ink-tertiary)] uppercase tracking-[0.06em] mt-0.5">
          platform
        </div>
      </div>
    </div>
  );
}

// --- rail node (payment rail endpoint) ---

interface RailConfig {
  name: string;
  logo: FC<{ className?: string }>;
  active: boolean;
  badge: string;
}

const RAILS: RailConfig[] = [
  { name: "Base", logo: BaseLogo, active: true, badge: "$0.002/tx" },
  { name: "Stripe", logo: StripeLogo, active: false, badge: "soon" },
  { name: "PayPal", logo: PayPalLogo, active: false, badge: "soon" },
  { name: "UPI", logo: UpiLogo, active: false, badge: "soon" },
];

function RailNode({
  rail,
  nodeRef,
}: {
  rail: RailConfig;
  nodeRef?: Ref<HTMLDivElement>;
}) {
  const Logo = rail.logo;

  return (
    <div
      ref={nodeRef}
      className={cn(
        nodeBase,
        "px-5 py-4 gap-3 min-w-[200px]",
        rail.active
          ? "border-[var(--rule-strong)] opacity-100 shadow-md"
          : "border-dashed border-[var(--rule-default)] opacity-40"
      )}
    >
      <Logo
        className={
          rail.active
            ? "text-[var(--ink-primary)]"
            : "text-[var(--ink-faint)]"
        }
      />
      <span
        className={cn(
          "font-body text-[15px] font-semibold leading-tight",
          rail.active
            ? "text-[var(--ink-primary)]"
            : "text-[var(--ink-faint)]"
        )}
      >
        {rail.name}
      </span>
      <span
        className={cn(
          "ml-auto",
          rail.active
            ? "font-data text-[11px] tabular-nums text-[var(--ink-tertiary)]"
            : "text-[9px] uppercase tracking-[0.06em] text-[var(--ink-faint)]"
        )}
      >
        {rail.badge}
      </span>
    </div>
  );
}

// --- desktop flow (hub-and-spoke with beams) ---

// beam offsets: start from right edge of hub, end at left edge of rail
const BEAM_START_X = 90;
const BEAM_END_X = -90;

function DesktopFlow() {
  const containerRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLDivElement>(null);
  // length must match RAILS
  const railRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];

  // gentle arcs fanning from hub to each rail
  const curvatures = [50, 18, -18, -50];

  return (
    <div
      ref={containerRef}
      className="relative hidden lg:flex items-center justify-between w-full max-w-[860px] mx-auto"
    >
      {/* hub — left, vertically centered */}
      <div className="flex items-center">
        <HubNode nodeRef={hubRef} />
      </div>

      {/* rails — stacked right */}
      <div className="flex flex-col gap-4">
        {RAILS.map((rail, i) => (
          <RailNode key={rail.name} rail={rail} nodeRef={railRefs[i]} />
        ))}
      </div>

      {/* glow halo behind active beam */}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={hubRef}
        toRef={railRefs[0]}
        curvature={curvatures[0]}
        startXOffset={BEAM_START_X}
        endXOffset={BEAM_END_X}
        gradientStartColor="var(--ink-tertiary)"
        gradientStopColor="var(--ink-primary)"
        pathColor="var(--ink-faint)"
        pathWidth={6}
        pathOpacity={0.06}
        duration={5}
      />

      {/* active beam — Base */}
      <AnimatedBeam
        containerRef={containerRef}
        fromRef={hubRef}
        toRef={railRefs[0]}
        curvature={curvatures[0]}
        startXOffset={BEAM_START_X}
        endXOffset={BEAM_END_X}
        gradientStartColor="var(--ink-tertiary)"
        gradientStopColor="var(--ink-primary)"
        pathColor="var(--ink-faint)"
        pathOpacity={0.35}
        duration={5}
      />

      {/* dashed beams — coming-soon rails */}
      {railRefs.slice(1).map((ref, i) => (
        <StaticDashedBeam
          key={RAILS[i + 1].name}
          containerRef={containerRef}
          fromRef={hubRef}
          toRef={ref}
          curvature={curvatures[i + 1]}
          startXOffset={BEAM_START_X}
          endXOffset={BEAM_END_X}
        />
      ))}
    </div>
  );
}

// --- mobile flow (vertical stack, no SVG) ---

function MobileFlow() {
  return (
    <div className="flex lg:hidden flex-col items-center gap-0">
      <HubNode />
      {RAILS.map((rail) => (
        <div key={rail.name} className="flex flex-col items-center">
          <div className="w-px h-6 border-l border-dashed border-[var(--ink-faint)]" />
          <div className={cn(rail.active && "border-l-2 border-l-[var(--rule-strong)]")}>
            <RailNode rail={rail} />
          </div>
        </div>
      ))}
    </div>
  );
}

// --- trust facts ---

function TrustFacts() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
      {TRUST_FACTS.map((fact, i) => (
        <span key={i} className="flex items-center gap-2">
          {i > 0 && (
            <span className="text-[var(--ink-faint)] text-[8px]">·</span>
          )}
          <span className="font-body text-[11px] text-[var(--ink-tertiary)]">
            {fact}
          </span>
        </span>
      ))}
    </div>
  );
}

// --- section ---

export function PaymentRailSection() {
  return (
    <section
      id="payment-rail"
      aria-labelledby="payment-rail-heading"
      className="relative bg-[var(--bg-secondary)] overflow-hidden scroll-mt-20"
    >
      <DotGrid opacity={0.35} variant="heartbeat" />

      <div className="relative mx-auto max-w-grid px-6 py-20">
        <div className="flex flex-col items-center text-center gap-8 lg:gap-12">
          {/* header — caption + h2 + one sentence */}
          <BlurFade inView delay={0}>
            <div className="flex flex-col items-center">
              <div className="font-body text-[10px] font-semibold text-[var(--ink-tertiary)] uppercase tracking-[0.1em] mb-3">
                The Payment Rail
              </div>
              <h2
                id="payment-rail-heading"
                className="font-display text-h2 md:text-h1 font-bold text-[var(--ink-primary)] tracking-[-0.02em] mb-4"
              >
                Your money, your way.
              </h2>
              <p className="font-body text-body text-[var(--ink-secondary)] max-w-[480px]">
                We start with USD on Base because micropayments demand sub-cent
                fees. More rails are coming.
              </p>
            </div>
          </BlurFade>

          {/* flow diagram — the star visual */}
          <BlurFade inView delay={0.1} className="w-full">
            <DesktopFlow />
            <MobileFlow />
          </BlurFade>

          {/* data strip — 3 metrics */}
          <BlurFade inView delay={0.2}>
            <DataStrip data={RAIL_METRICS} separator="rule" />
          </BlurFade>

          {/* trust facts */}
          <BlurFade inView delay={0.3}>
            <TrustFacts />
          </BlurFade>
        </div>
      </div>
    </section>
  );
}
