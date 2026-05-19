"use client"
import { type ReactNode, useState } from "react"
import { SharpButton } from "@/components/v5/sharp-button"

interface Props {
  open: boolean
  title: string
  onClose: () => void
  onSave: () => Promise<void> | void
  saveLabel?: string
  children: ReactNode
}

export function InlineEditPanel({
  open,
  title,
  onClose,
  onSave,
  saveLabel = "save",
  children,
}: Props) {
  const [saving, setSaving] = useState(false)
  if (!open) return null

  async function handleSave() {
    setSaving(true)
    try {
      await onSave()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="border border-[var(--rule-default)] bg-[var(--bg-surface)] mt-2 mb-4">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--rule-default)]">
        <span className="font-[var(--font-display)] text-[10px] tracking-[0.1em] uppercase text-[var(--ink-secondary)] font-bold">
          {title}
        </span>
        <button
          onClick={onClose}
          className="font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] hover:text-[var(--ink-primary)]"
        >
          close ✕
        </button>
      </div>
      <div className="px-4 py-4 space-y-3">{children}</div>
      <div className="flex gap-2 px-4 py-3 border-t border-[var(--rule-default)]">
        <SharpButton variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "saving…" : saveLabel}
        </SharpButton>
        <SharpButton variant="secondary" onClick={onClose} disabled={saving}>
          cancel
        </SharpButton>
      </div>
    </div>
  )
}
