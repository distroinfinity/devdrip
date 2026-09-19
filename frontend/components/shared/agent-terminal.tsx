"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { terminalColors as tc } from "@/lib/design-tokens";

const BRAILLE_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

const TASKS = [
  {
    text: "Refactoring auth module across 4 files",
    files: [
      "src/auth/middleware.ts",
      "src/auth/session.ts",
      "src/auth/guards.ts",
      "src/lib/jwt.ts",
    ],
  },
  {
    text: "Migrating database schema to v3",
    files: [
      "prisma/schema.prisma",
      "src/db/migrations/003.ts",
      "src/db/client.ts",
    ],
  },
  {
    text: "Adding error boundaries to 6 routes",
    files: [
      "src/app/dashboard/error.tsx",
      "src/app/settings/error.tsx",
      "src/app/billing/error.tsx",
      "src/components/error-fallback.tsx",
    ],
  },
  {
    text: "Optimizing bundle with dynamic imports",
    files: [
      "src/app/layout.tsx",
      "src/components/heavy-chart.tsx",
      "src/lib/analytics.ts",
      "next.config.ts",
    ],
  },
  {
    text: "Implementing rate limiter middleware",
    files: [
      "src/middleware.ts",
      "src/lib/rate-limit.ts",
      "src/config/limits.ts",
    ],
  },
];

interface AgentTerminalProps {
  className?: string;
}

export function AgentTerminal({ className }: AgentTerminalProps) {
  const [spinnerFrame, setSpinnerFrame] = useState(0);
  const [taskIndex, setTaskIndex] = useState(0);
  const [typedChars, setTypedChars] = useState(0);
  const [showFiles, setShowFiles] = useState(false);
  const [idleSeconds, setIdleSeconds] = useState(30);
  const typingDone = useRef(false);

  const task = TASKS[taskIndex];

  // braille spinner — 80ms cycle
  useEffect(() => {
    const iv = setInterval(
      () => setSpinnerFrame((f) => (f + 1) % BRAILLE_FRAMES.length),
      80
    );
    return () => clearInterval(iv);
  }, []);

  // typing effect — 45ms per char
  useEffect(() => {
    typingDone.current = false;
    setTypedChars(0);
    setShowFiles(false);

    const iv = setInterval(() => {
      setTypedChars((prev) => {
        if (prev >= task.text.length) {
          clearInterval(iv);
          typingDone.current = true;
          return prev;
        }
        return prev + 1;
      });
    }, 45);

    return () => clearInterval(iv);
  }, [taskIndex, task.text.length]);

  // show files after typing completes
  useEffect(() => {
    if (typedChars < task.text.length) return;

    const timeout = setTimeout(() => setShowFiles(true), 200);
    return () => clearTimeout(timeout);
  }, [typedChars, task.text.length]);

  // cycle tasks — hold 8s after typing completes
  const cycleTask = useCallback(() => {
    setTaskIndex((i) => (i + 1) % TASKS.length);
  }, []);

  useEffect(() => {
    if (typedChars < task.text.length) return;

    const timeout = setTimeout(cycleTask, 8000);
    return () => clearTimeout(timeout);
  }, [typedChars, task.text.length, cycleTask]);

  // idle timer
  useEffect(() => {
    const iv = setInterval(
      () => setIdleSeconds((s) => s + 1),
      1000
    );
    return () => clearInterval(iv);
  }, []);

  const minutes = Math.floor(idleSeconds / 60);
  const seconds = idleSeconds % 60;
  const idleDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div
      className={cn("overflow-hidden select-none", className)}
      style={{
        background: tc.bg,
        border: `1px solid ${tc.border}`,
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 13,
        color: tc.text,
      }}
    >
      {/* header */}
      <div
        className="flex items-center gap-2 px-3.5 py-2"
        style={{
          borderBottom: `1px solid ${tc.border}`,
          fontSize: 11,
          color: tc.textTertiary,
          letterSpacing: "0.04em",
        }}
      >
        <span style={{ color: tc.textSecondary }}>
          {BRAILLE_FRAMES[spinnerFrame]}
        </span>
        <span>Claude Code</span>
      </div>

      {/* body */}
      <div className="px-3.5 pt-3 pb-3">
        {/* current task with typing */}
        <div className="flex items-start gap-2 mb-3">
          <span style={{ color: tc.textSecondary }}>
            {BRAILLE_FRAMES[spinnerFrame]}
          </span>
          <span>
            {task.text.slice(0, typedChars)}
            {typedChars < task.text.length && (
              <span
                className="inline-block w-[7px] h-[14px] ml-px align-middle"
                style={{
                  background: tc.textSecondary,
                  animation: "blink-cursor 1s step-end infinite",
                }}
              />
            )}
          </span>
        </div>

        {/* file list — staggered fade */}
        <div className="ml-5 space-y-0.5">
          {task.files.map((file, i) => (
            <div
              key={`${taskIndex}-${file}`}
              className="transition-opacity duration-300"
              style={{
                opacity: showFiles ? 1 : 0,
                transitionDelay: `${i * 100}ms`,
                fontSize: 12,
                color: tc.textSecondary,
              }}
            >
              <span style={{ color: tc.textTertiary }}>▸</span> {file}
            </div>
          ))}
        </div>

        {/* idle timer */}
        <div
          className="mt-4 text-right"
          style={{ fontSize: 11, color: tc.textFaint }}
        >
          idle time: {idleDisplay}
        </div>
      </div>
    </div>
  );
}
