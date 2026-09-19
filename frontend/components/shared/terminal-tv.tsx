"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { terminalColors as tc } from "@/lib/design-tokens";

interface TerminalTVContent {
  sponsor: string;
  description: string;
  cta: string;
  earning: string;
}

interface TerminalTVProps {
  contents?: TerminalTVContent[];
  rotationIntervalMs?: number;
  className?: string;
  onDiscover?: () => void;
  onSkip?: () => void;
  onMute?: () => void;
}

const defaultContents: TerminalTVContent[] = [
  {
    sponsor: "Neon Database",
    description: "Serverless Postgres that scales to zero.\nCut your DB bill by 80%.",
    cta: "neon.tech/devdrip",
    earning: "$0.02",
  },
  {
    sponsor: "Railway",
    description: "Deploy any app in seconds.\nZero config, instant rollbacks.",
    cta: "railway.app/devdrip",
    earning: "$0.03",
  },
  {
    sponsor: "Turso",
    description: "SQLite at the edge.\nReplicate globally, query locally.",
    cta: "turso.tech/devdrip",
    earning: "$0.02",
  },
];

export function TerminalTV({
  contents = defaultContents,
  rotationIntervalMs = 15000,
  className,
  onDiscover,
  onSkip,
  onMute,
}: TerminalTVProps) {
  const [contentIndex, setContentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(false);

  const current = contents[contentIndex];

  // content rotation
  useEffect(() => {
    const iv = setInterval(() => {
      setContentIndex((prev) => (prev + 1) % contents.length);
      setProgress(0);
    }, rotationIntervalMs);
    return () => clearInterval(iv);
  }, [contents.length, rotationIntervalMs]);

  // progress bar
  useEffect(() => {
    const iv = setInterval(
      () => setProgress((prev) => (prev >= 100 ? 0 : prev + 1)),
      90,
    );
    return () => clearInterval(iv);
  }, []);

  const filled = Math.floor(progress / 5);
  const bar = "\u2593".repeat(filled) + "\u2591".repeat(20 - filled);

  const handleSkip = useCallback(() => {
    setContentIndex((prev) => (prev + 1) % contents.length);
    setProgress(0);
    onSkip?.();
  }, [contents.length, onSkip]);

  const handleMute = useCallback(() => {
    setMuted(true);
    onMute?.();
    setTimeout(() => setMuted(false), 3000); // brief visual feedback
  }, [onMute]);

  // keyboard handling — only when focused
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (key === "s") {
        e.preventDefault();
        handleSkip();
      } else if (key === "d") {
        e.preventDefault();
        onDiscover?.();
      } else if (key === "m") {
        e.preventDefault();
        handleMute();
      }
    },
    [handleSkip, onDiscover, handleMute],
  );

  return (
    <div
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        "overflow-hidden outline-none focus:ring-1 focus:ring-[#5C5C66]",
        className,
      )}
      style={{
        background: tc.bg,
        border: `1px solid ${tc.border}`,
        borderRadius: 0,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 13,
        color: tc.text,
      }}
    >
      {/* header */}
      <div
        className="flex justify-between items-center px-3.5 py-2"
        style={{
          borderBottom: `1px solid ${tc.border}`,
          fontSize: 11,
          color: tc.textTertiary,
          letterSpacing: "0.04em",
        }}
      >
        <span>DEV DRIP TV</span>
        <span style={{ color: tc.text, fontWeight: 700 }}>
          {current?.earning}
        </span>
      </div>

      {/* content */}
      <div className="px-3.5 pt-3.5 pb-2.5">
        {muted ? (
          <div style={{ color: tc.textTertiary, fontSize: 12 }}>
            Muted for 30 min
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              {current?.sponsor}
            </div>
            <div
              style={{
                color: tc.textSecondary,
                fontSize: 12,
                lineHeight: 1.5,
                marginBottom: 14,
                whiteSpace: "pre-line",
              }}
            >
              {current?.description}
            </div>
          </>
        )}

        {/* action keys */}
        <div className="flex gap-2.5" style={{ fontSize: 11 }}>
          {[
            { label: "[D]iscover", primary: true },
            { label: "[S]kip", primary: false },
            { label: "[M]ute", primary: false },
          ].map((action) => (
            <span
              key={action.label}
              className="cursor-pointer"
              style={{
                padding: "3px 8px",
                border: `1px solid ${action.primary ? tc.textTertiary : tc.border}`,
                color: action.primary ? tc.text : tc.textTertiary,
              }}
            >
              {action.label}
            </span>
          ))}
        </div>
      </div>

      {/* footer with progress bar */}
      <div
        className="flex justify-between items-center px-3.5 py-2"
        style={{
          borderTop: `1px solid ${tc.border}`,
          fontSize: 11,
          color: tc.textFaint,
        }}
      >
        <span style={{ letterSpacing: 1 }}>{bar}</span>
        <span style={{ color: tc.textTertiary }}>{progress}%</span>
      </div>
    </div>
  );
}
