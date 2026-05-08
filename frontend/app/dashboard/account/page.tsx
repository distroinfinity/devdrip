import { redirect } from "next/navigation"
import { getSession, clearSessionCookie } from "@/lib/session"
import { apiFetchOrRefresh } from "@/lib/api"
import { SectionRule } from "@/components/v5/section-rule"
import { SharpButton } from "@/components/v5/sharp-button"
import { EmptyState } from "@/components/v5/empty-state"
import type { Device } from "@distrotv/shared"

function relativeTime(iso: string | null): string {
  if (!iso) return "never"
  const ms = Date.now() - new Date(iso).getTime()
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return "just now"
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`
  return `${Math.floor(sec / 86400)}d ago`
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

interface DevicesPayload {
  devices: Device[]
}

export default async function AccountPage() {
  const session = await getSession()
  if (!session) {
    redirect("/sign-in?next=/dashboard/account")
  }

  const sessionExpires = new Date(session.exp * 1000)
  const nowMs = Date.now()
  const expiresIn = sessionExpires.getTime() - nowMs
  const expiresStr =
    expiresIn <= 0
      ? "expired"
      : expiresIn < 86400000
        ? `in ${Math.floor(expiresIn / 3600000)}h`
        : `in ${Math.floor(expiresIn / 86400000)}d`

  // fetch device details if paired
  let device: Device | null = null
  if (session.deviceId) {
    const data = await apiFetchOrRefresh<DevicesPayload>("/devices", "/dashboard/account").catch(
      () => null
    )
    device = data?.devices.find((d) => d.id === session.deviceId) ?? null
  }

  return (
    <div className="max-w-lg">
      {/* ── You ── */}
      <section>
        <p className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)] mb-4">
          You
        </p>
        <dl className="space-y-3">
          <Row label="Email" value={session.email ?? "anonymous"} />
          <Row label="User ID" value={session.userId} mono />
          <Row label="Session" value={`${sessionExpires.toLocaleString()} · ${expiresStr}`} />
        </dl>
      </section>

      <SectionRule />

      {/* ── Device ── */}
      <section>
        <p className="font-[var(--font-display)] text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)] mb-4">
          Device
        </p>

        {device ? (
          <dl className="space-y-3">
            <Row label="Name" value={device.deviceName ?? "unnamed device"} mono bold />
            <Row label="OS" value={device.os} />
            <Row label="IDE" value={device.ideType} />
            <Row label="Last seen" value={relativeTime(device.lastHeartbeat)} mono />
            <Row label="Paired" value={formatDate(device.createdAt)} />
          </dl>
        ) : session.deviceId ? (
          // has deviceId but fetch failed
          <dl className="space-y-3">
            <Row label="Device ID" value={session.deviceId} mono />
          </dl>
        ) : (
          <EmptyState
            title="no device paired"
            body="run distro init from your terminal to pair this account with your machine"
            action={
              <pre className="text-[10px] font-[var(--font-data)] bg-[var(--bg-inset,var(--bg-surface))] border border-[var(--rule-default)] p-3 inline-block text-left text-[var(--ink-primary)]">
                {`curl -fsSL https://distrotv.dev/install.sh | sh\ndistro init`}
              </pre>
            }
          />
        )}
      </section>

      <SectionRule />

      {/* ── Sign out ── */}
      <form
        action={async () => {
          "use server"
          await clearSessionCookie()
          redirect("/sign-in")
        }}
      >
        <SharpButton type="submit" variant="secondary">
          Sign out
        </SharpButton>
      </form>
    </div>
  )
}

interface RowProps {
  label: string
  value: string
  mono?: boolean
  bold?: boolean
}

function Row({ label, value, mono, bold }: RowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-[var(--font-display)] text-[9px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
        {label}
      </dt>
      <dd
        className={[
          "text-[13px] text-[var(--ink-primary)]",
          mono ? "font-[var(--font-data)] tracking-[0.02em]" : "font-[var(--font-body)]",
          bold ? "font-bold" : "",
        ].join(" ")}
      >
        {value}
      </dd>
    </div>
  )
}
