"use client"

import { useState, useTransition } from "react"
import type { ChannelDto, SyncedPreferences } from "@distrotv/shared"
import { cn } from "@distrotv/design-system/utils"
import { savePreferences, saveChannels } from "@/app/dashboard/preferences/actions"
import { QuietHoursPicker } from "./quiet-hours-picker"
import { AdvancedBlock } from "./advanced-block"
import { ChannelsGrid } from "./channels-grid"

interface PreferencesFormProps {
  initial: SyncedPreferences
  initialChannels: ChannelDto[]
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string }

export function PreferencesForm({ initial, initialChannels }: PreferencesFormProps) {
  const [prefs, setPrefs] = useState<SyncedPreferences>(initial)
  const [savedSnapshot, setSavedSnapshot] = useState<SyncedPreferences>(initial)
  const [channels, setChannels] = useState<ChannelDto[]>(initialChannels)
  const [savedChannels, setSavedChannels] = useState<ChannelDto[]>(initialChannels)
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [pending, startTransition] = useTransition()

  const channelsDirty = channels.some((c, i) => {
    const s = savedChannels[i]
    return c.key !== s?.key || c.subscribed !== s?.subscribed || c.priority !== s?.priority
  })
  const dirty = JSON.stringify(prefs) !== JSON.stringify(savedSnapshot) || channelsDirty

  function patch(p: Partial<SyncedPreferences>): void {
    setPrefs((cur) => ({ ...cur, ...p }))
    if (status.kind === "error") setStatus({ kind: "idle" })
  }

  function save(): void {
    if (!dirty || pending) return
    const snapshot = prefs
    const subscribedKeys = channels.filter((c) => c.subscribed).map((c) => c.key)
    if (subscribedKeys.length === 0) {
      setStatus({ kind: "error", message: "pick at least one channel before saving" })
      return
    }
    startTransition(async () => {
      setStatus({ kind: "saving" })
      const result = await savePreferences({
        quietHoursStart: snapshot.quietHoursStart,
        quietHoursEnd: snapshot.quietHoursEnd,
        tzOffsetMinutes: snapshot.tzOffsetMinutes,
        idleSensitivityMs: snapshot.idleSensitivityMs,
        sessionWarmupMs: snapshot.sessionWarmupMs,
        nightMode: snapshot.nightMode,
      })
      if (result.ok && result.preferences) {
        setSavedSnapshot(result.preferences)
        setPrefs(result.preferences)
      } else {
        setStatus({ kind: "error", message: result.error ?? "save failed" })
        return
      }

      const channelResult = await saveChannels(subscribedKeys)
      if (channelResult.ok && channelResult.channels) {
        setSavedChannels(channelResult.channels)
        setChannels(channelResult.channels)
        setStatus({ kind: "saved", at: Date.now() })
      } else {
        // prefs saved successfully; surface channels error but keep prefs snapshot
        setStatus({ kind: "error", message: channelResult.error ?? "channels save failed" })
      }
    })
  }

  function reset(): void {
    setPrefs(savedSnapshot)
    setChannels(savedChannels)
    setStatus({ kind: "idle" })
  }

  return (
    <div className="flex flex-col gap-6 pb-32">
      <Section title="Channels" subtitle="which feeds appear in your slot rotation">
        <ChannelsGrid channels={channels} onChange={setChannels} disabled={pending} />
      </Section>

      <Section title="Quiet hours" subtitle="silence specific hours of the day">
        <QuietHoursPicker
          start={prefs.quietHoursStart}
          end={prefs.quietHoursEnd}
          tzOffsetMinutes={prefs.tzOffsetMinutes}
          onChange={patch}
          disabled={pending}
        />
      </Section>

      <Section title="Advanced" subtitle="defaults usually work; tune only if you know why">
        <AdvancedBlock
          idleSensitivityMs={prefs.idleSensitivityMs}
          sessionWarmupMs={prefs.sessionWarmupMs}
          nightMode={prefs.nightMode}
          onChange={patch}
          disabled={pending}
        />
      </Section>

      <SaveBar
        dirty={dirty}
        status={status}
        onSave={save}
        onReset={reset}
        lastSyncedAt={savedSnapshot.updatedAt}
      />
    </div>
  )
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-[var(--rule-default)] bg-[var(--bg-surface)] px-5 py-5 md:px-6 md:py-6">
      <header className="mb-4">
        <h2 className="font-display text-[14px] font-bold tracking-[-0.01em] text-[var(--ink-primary)]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-1 font-body text-[12px] text-[var(--ink-secondary)]">{subtitle}</p>
        )}
      </header>
      {children}
    </section>
  )
}

function SaveBar({
  dirty,
  status,
  onSave,
  onReset,
  lastSyncedAt,
}: {
  dirty: boolean
  status: Status
  onSave: () => void
  onReset: () => void
  lastSyncedAt: string
}) {
  return (
    <div
      className={cn(
        "fixed bottom-0 left-0 right-0 z-[var(--z-sticky)] border-t border-[var(--rule-default)] bg-[var(--bg-elevated)]/95 backdrop-blur transition-transform duration-200",
        dirty || status.kind === "saving" || status.kind === "saved" || status.kind === "error"
          ? "translate-y-0"
          : "translate-y-full"
      )}
    >
      <div className="mx-auto flex max-w-grid items-center justify-between gap-4 px-6 py-3 md:px-12">
        <StatusLine status={status} dirty={dirty} lastSyncedAt={lastSyncedAt} />
        <div className="flex items-center gap-2">
          {dirty && status.kind !== "saving" && (
            <button
              type="button"
              onClick={onReset}
              className="font-display text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]"
            >
              discard
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={!dirty || status.kind === "saving"}
            className={cn(
              "rounded-md px-4 py-2 font-display text-[11px] font-bold uppercase tracking-[0.12em] transition-colors",
              dirty
                ? "bg-[var(--accent-color)] text-white hover:bg-[var(--accent-hover)]"
                : "bg-[var(--bg-inset)] text-[var(--ink-tertiary)]"
            )}
          >
            {status.kind === "saving" ? "saving…" : "save"}
          </button>
        </div>
      </div>
    </div>
  )
}

function StatusLine({
  status,
  dirty,
  lastSyncedAt,
}: {
  status: Status
  dirty: boolean
  lastSyncedAt: string
}) {
  if (status.kind === "saving") {
    return <span className="font-body text-[12px] text-[var(--ink-secondary)]">saving…</span>
  }
  if (status.kind === "error") {
    return (
      <span className="font-body text-[12px] text-[var(--status-negative)]">
        save failed: {status.message}
      </span>
    )
  }
  if (status.kind === "saved") {
    return (
      <span className="font-body text-[12px] text-[var(--ink-secondary)]">
        saved · cli will pick up within 30 min
      </span>
    )
  }
  if (dirty) {
    return (
      <span className="font-body text-[12px] text-[var(--ink-secondary)]">unsaved changes</span>
    )
  }
  return (
    <span className="font-body text-[12px] text-[var(--ink-tertiary)]">
      last saved {formatRelative(lastSyncedAt)}
    </span>
  )
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t) || t === 0) return "never"
  const sec = Math.round((Date.now() - t) / 1000)
  if (sec < 60) return `${sec}s ago`
  const min = Math.round(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr}h ago`
  return new Date(iso).toLocaleDateString()
}
