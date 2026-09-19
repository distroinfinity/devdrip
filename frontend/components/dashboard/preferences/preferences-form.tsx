"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import type { AlertDto, AlertReplacement, ChannelDto, SyncedPreferences } from "@distrotv/shared"
import { ChannelMode } from "@distrotv/shared"
import { cn } from "@distrotv/design-system/utils"
import { savePreferences, saveChannels, saveAlerts } from "@/app/dashboard/preferences/actions"
import { SortableList } from "@/components/dashboard/dnd/sortable-list"
import { ChannelRow } from "./channels-grid"
import { AlertsBlock } from "./alerts-block"
import { QuietHoursBlock } from "./quiet-hours-block"
import { ModePill } from "@/components/dashboard/mode-pill"
import { SectionRule } from "@/components/v5/section-rule"
import { InlineHelp } from "@/components/v5/inline-help"

interface PreferencesFormProps {
  initial: SyncedPreferences
  initialChannels: ChannelDto[]
  initialAlerts: AlertDto[]
}

type Status =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved"; at: number }
  | { kind: "error"; message: string }

type QuietHoursState = { startMinutes: number | null; endMinutes: number | null }

const MODE_DESCRIPTIONS: Record<ChannelMode, string> = {
  [ChannelMode.NewsOnly]: "news only — no ticker slots in your rotation",
  [ChannelMode.NewsHeavy]: "3:1 — three news slots for every ticker slot",
  [ChannelMode.Balanced]: "1:1 — news and ticker alternate evenly",
  [ChannelMode.TickerHeavy]: "1:3 — three ticker slots for every news slot",
  [ChannelMode.TickerOnly]: "ticker only — no news slots in your rotation",
}

export function PreferencesForm({ initial, initialChannels, initialAlerts }: PreferencesFormProps) {
  const [channels, setChannels] = useState<ChannelDto[]>(initialChannels)
  const [savedChannels, setSavedChannels] = useState<ChannelDto[]>(initialChannels)
  const [alerts, setAlerts] = useState<AlertDto[]>(initialAlerts)
  const [savedAlerts, setSavedAlerts] = useState<AlertDto[]>(initialAlerts)
  const [quietHours, setQuietHours] = useState<QuietHoursState>({
    startMinutes: initial.quietHoursStart,
    endMinutes: initial.quietHoursEnd,
  })
  const [savedQuietHours, setSavedQuietHours] = useState<QuietHoursState>({
    startMinutes: initial.quietHoursStart,
    endMinutes: initial.quietHoursEnd,
  })
  const [prefs, setPrefs] = useState<SyncedPreferences>(initial)
  const [savedSnapshot, setSavedSnapshot] = useState<SyncedPreferences>(initial)
  const [status, setStatus] = useState<Status>({ kind: "idle" })
  const [pending, startTransition] = useTransition()

  const channelsDirty =
    channels.some((c, i) => {
      const s = savedChannels[i]
      return c.key !== s?.key || c.subscribed !== s?.subscribed || c.priority !== s?.priority
    }) || channels.length !== savedChannels.length
  const alertsDirty =
    alerts.length !== savedAlerts.length ||
    alerts.some((a, i) => {
      const s = savedAlerts[i]
      return !s || a.scope !== s.scope || a.symbol !== s.symbol || a.thresholdPct !== s.thresholdPct
    })
  const quietHoursDirty =
    quietHours.startMinutes !== savedQuietHours.startMinutes ||
    quietHours.endMinutes !== savedQuietHours.endMinutes
  const prefsDirty = JSON.stringify(prefs) !== JSON.stringify(savedSnapshot)
  const dirty = prefsDirty || channelsDirty || alertsDirty || quietHoursDirty

  function save(): void {
    if (!dirty || pending) return
    const subscribedKeys = channels.filter((c) => c.subscribed).map((c) => c.key)
    if (subscribedKeys.length === 0) {
      setStatus({ kind: "error", message: "pick at least one channel before saving" })
      return
    }
    startTransition(async () => {
      setStatus({ kind: "saving" })
      const result = await savePreferences({
        quietHoursStart: quietHours.startMinutes,
        quietHoursEnd: quietHours.endMinutes,
        tzOffsetMinutes: prefs.tzOffsetMinutes,
        idleSensitivityMs: prefs.idleSensitivityMs,
        sessionWarmupMs: prefs.sessionWarmupMs,
        nightMode: prefs.nightMode,
      })
      if (result.ok && result.preferences) {
        setSavedSnapshot(result.preferences)
        setPrefs(result.preferences)
        setSavedQuietHours({
          startMinutes: result.preferences.quietHoursStart,
          endMinutes: result.preferences.quietHoursEnd,
        })
      } else {
        setStatus({ kind: "error", message: result.error ?? "save failed" })
        return
      }

      const channelResult = await saveChannels(subscribedKeys)
      if (!channelResult.ok || !channelResult.channels) {
        setStatus({ kind: "error", message: channelResult.error ?? "channels save failed" })
        return
      }
      setSavedChannels(channelResult.channels)
      setChannels(channelResult.channels)

      const alertsReplacement: AlertReplacement[] = alerts.map((a) => ({
        scope: a.scope,
        symbol: a.symbol,
        thresholdPct: a.thresholdPct,
      }))
      const alertsResult = await saveAlerts(alertsReplacement)
      if (alertsResult.ok && alertsResult.alerts) {
        setSavedAlerts(alertsResult.alerts)
        setAlerts(alertsResult.alerts)
        setStatus({ kind: "saved", at: Date.now() })
      } else {
        setStatus({ kind: "error", message: alertsResult.error ?? "alerts save failed" })
      }
    })
  }

  function reset(): void {
    setChannels(savedChannels)
    setAlerts(savedAlerts)
    setQuietHours(savedQuietHours)
    setPrefs(savedSnapshot)
    setStatus({ kind: "idle" })
  }

  // use channel.key as the sortable id (overrides channel.id to ensure uniqueness as stable key)
  type SortableChannel = ChannelDto & { id: string }

  function handleChannelReorder(items: SortableChannel[]) {
    setChannels(items)
  }

  const sortableChannels: SortableChannel[] = channels.map((c) => ({ ...c, id: c.key }))

  return (
    <div className="flex flex-col pb-32">
      {/* Mode */}
      <PrefsSection eyebrow="mode" subtitle="bias your feed toward news or ticker">
        <ModePill initial={initial.channelMode} />
        <p className="mt-2 text-[11px] text-[var(--ink-tertiary)] font-[var(--font-body)]">
          {MODE_DESCRIPTIONS[initial.channelMode]}
        </p>
      </PrefsSection>

      <SectionRule />

      {/* Channels */}
      <PrefsSection
        eyebrow="channels"
        subtitle="which feeds appear in your slot rotation — drag to set priority"
        help={
          <InlineHelp>
            drag rows to reorder. higher channels are picked first when news rotates.
          </InlineHelp>
        }
      >
        <SortableList
          items={sortableChannels}
          onReorder={handleChannelReorder}
          renderItem={(item, dragHandle) => (
            <ChannelRow
              channel={item}
              dragHandle={dragHandle}
              disabled={pending}
              onToggle={() => {
                if (pending) return
                setChannels((prev) =>
                  prev.map((c) => (c.key === item.key ? { ...c, subscribed: !c.subscribed } : c))
                )
              }}
            />
          )}
        />
      </PrefsSection>

      <SectionRule />

      {/* Watchlist link */}
      <PrefsSection eyebrow="watchlist" subtitle="tickers tracked in your slot rotation">
        <Link
          href="/dashboard/watchlists"
          className="inline-flex items-center gap-1.5 text-[13px] text-[var(--ink-primary)] hover:text-[var(--accent-color)] font-[var(--font-body)] transition-colors"
        >
          Manage tickers <span aria-hidden="true">→</span>
        </Link>
      </PrefsSection>

      <SectionRule />

      {/* Alerts */}
      <PrefsSection
        eyebrow="alerts"
        subtitle="fire when |daily move| ≥ threshold; bumps the next slot"
      >
        <AlertsBlock alerts={alerts} onChange={setAlerts} disabled={pending} />
      </PrefsSection>

      <SectionRule />

      {/* Quiet hours */}
      <PrefsSection eyebrow="quiet hours" subtitle="silence alerts during a daily window">
        <QuietHoursBlock
          startMinutes={quietHours.startMinutes}
          endMinutes={quietHours.endMinutes}
          tzOffsetMinutes={prefs.tzOffsetMinutes}
          onChange={setQuietHours}
          disabled={pending}
        />
      </PrefsSection>

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

function PrefsSection({
  eyebrow,
  subtitle,
  help,
  children,
}: {
  eyebrow: string
  subtitle?: string
  help?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="py-1">
      <header className="mb-4">
        <div className="flex items-baseline gap-1">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] font-[var(--font-display)] text-[var(--ink-tertiary)]">
            {eyebrow}
          </p>
          {help}
        </div>
        {subtitle && (
          <p className="mt-1 text-[12px] text-[var(--ink-secondary)] font-[var(--font-body)]">
            {subtitle}
          </p>
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
              "px-4 py-2 font-display text-[11px] font-bold uppercase tracking-[0.12em] transition-colors rounded-none",
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
