"use client"

import { useId, useState, useTransition, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { SharpButton } from "@/components/v5/sharp-button"
import { SharpInput } from "@/components/v5/sharp-input"
import { cn } from "@/lib/utils"
import {
  AD_LIMITS as L,
  adError,
  type AdField,
  type AdvertiserAd,
  type CreateAdBody,
} from "@/lib/advertiser-ads"
import { SlotPreview } from "./slot-preview"

interface SubmitResult {
  ok: boolean
  ad?: AdvertiserAd
  error?: string
}

interface Props {
  // with `submit` the composer saves through the api and takes a bid;
  // without it, it hands the copy to the portal in the url
  submit?: (body: CreateAdBody) => Promise<SubmitResult>
  initial?: { brand?: string; line?: string; url?: string }
}

type Errors = Partial<Record<AdField, string>>

function isHttps(value: string): boolean {
  try {
    const u = new URL(value)
    return u.protocol === "https:" && u.hostname.includes(".")
  } catch {
    return false
  }
}

export function AdComposer({ submit, initial }: Props) {
  const router = useRouter()
  const uid = useId()
  const [brand, setBrand] = useState(initial?.brand?.slice(0, L.brandMax) ?? "")
  const [line, setLine] = useState(initial?.line?.slice(0, L.lineMax) ?? "")
  const [url, setUrl] = useState(initial?.url?.slice(0, L.urlMax) ?? "")
  const [bid, setBid] = useState(String(L.bidDefault))
  const [errors, setErrors] = useState<Errors>({})
  const [notice, setNotice] = useState("")
  const [pending, startTransition] = useTransition()

  const validate = (): Errors => {
    const next: Errors = {}
    const b = brand.trim().length
    const l = line.trim().length
    if (b < L.brandMin || b > L.brandMax) next.brand = adError("invalid_brand").message
    if (l < L.lineMin || l > L.lineMax) next.line = adError("invalid_line").message
    if (!isHttps(url.trim()) || url.trim().length > L.urlMax)
      next.url = adError("invalid_url").message
    if (submit) {
      const n = Number(bid)
      if (!Number.isFinite(n) || n < L.bidMin || n > L.bidMax)
        next.bid = adError("invalid_bid").message
    }
    return next
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    setNotice("")
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const body = { brand: brand.trim(), line: line.trim(), url: url.trim() }
    if (!submit) {
      // ad copy only — nothing personal goes in the url
      const q = `brand=${encodeURIComponent(body.brand)}&line=${encodeURIComponent(body.line)}&url=${encodeURIComponent(body.url)}`
      router.push(`/advertisers/portal?${q}`)
      return
    }

    startTransition(async () => {
      const res = await submit({ ...body, bidCpm: Number(bid) })
      if (!res.ok) {
        const { field, message } = adError(res.error ?? "")
        setErrors({ [field]: message })
        return
      }
      setBrand("")
      setLine("")
      setUrl("")
      setBid(String(L.bidDefault))
      setNotice(
        res.ad?.status === "review"
          ? "Submitted for review."
          : "Running. It reaches terminals within a few minutes."
      )
      router.refresh()
    })
  }

  const field = (name: AdField) => ({
    id: `${uid}-${name}`,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": `${uid}-${name}-help`,
  })

  return (
    <div className="grid gap-8 md:grid-cols-[1fr_1.05fr] md:gap-12 items-start">
      <form onSubmit={onSubmit} noValidate className="min-w-0 space-y-3">
        <Field
          label="Brand"
          htmlFor={`${uid}-brand`}
          helpId={`${uid}-brand-help`}
          error={errors.brand}
        >
          <SharpInput
            {...field("brand")}
            className="w-full"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            maxLength={L.brandMax}
            autoComplete="organization"
            placeholder="Your brand"
          />
        </Field>

        <Field
          label="One line"
          htmlFor={`${uid}-line`}
          helpId={`${uid}-line-help`}
          error={errors.line}
          aside={
            <span
              className={cn(
                "font-data text-[11px] tabular-nums",
                line.length >= L.lineMax
                  ? "text-[var(--status-caution)]"
                  : "text-[var(--ink-tertiary)]"
              )}
            >
              {line.length}/{L.lineMax}
            </span>
          }
        >
          <textarea
            {...field("line")}
            rows={3}
            value={line}
            onChange={(e) => setLine(e.target.value.replace(/\n/g, " "))}
            maxLength={L.lineMax}
            placeholder="What you'd say in one sentence."
            className="block w-full resize-none rounded-none border border-[var(--rule-default)] bg-[var(--bg-surface)] px-3 py-2 font-[var(--font-body)] text-[13px] text-[var(--ink-primary)] placeholder:text-[var(--ink-tertiary)] focus:border-[var(--accent-color)] focus:outline-none"
          />
        </Field>

        <Field label="Link" htmlFor={`${uid}-url`} helpId={`${uid}-url-help`} error={errors.url}>
          <SharpInput
            {...field("url")}
            className="w-full"
            type="url"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            maxLength={L.urlMax}
            autoComplete="url"
            placeholder="https://…"
          />
        </Field>

        {submit && (
          <Field
            label="Bid (CPM, USD)"
            htmlFor={`${uid}-bid`}
            helpId={`${uid}-bid-help`}
            error={errors.bid}
            help="Higher bids run first. Not charged during the pilot."
          >
            <SharpInput
              {...field("bid")}
              className="w-[120px]"
              type="number"
              inputMode="decimal"
              min={L.bidMin}
              max={L.bidMax}
              step="1"
              value={bid}
              onChange={(e) => setBid(e.target.value)}
            />
          </Field>
        )}

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
          <SharpButton type="submit" disabled={pending}>
            {pending ? "Saving…" : "Run this ad"}
          </SharpButton>
          <p role="status" className="m-0 font-body text-[13px] text-[var(--status-positive)]">
            {notice}
          </p>
        </div>
        {errors.form && (
          <p role="alert" className="m-0 font-body text-[13px] text-[var(--status-negative)]">
            {errors.form}
          </p>
        )}
      </form>

      <SlotPreview brand={brand} line={line} className="min-w-0 md:sticky md:top-24" />
    </div>
  )
}

function Field({
  label,
  htmlFor,
  helpId,
  help,
  error,
  aside,
  children,
}: {
  label: string
  htmlFor: string
  helpId: string
  help?: string
  error?: string
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="font-body text-[13px] text-[var(--ink-primary)]">
          {label}
        </label>
        {aside}
      </div>
      {children}
      <p
        id={helpId}
        className={cn(
          "m-0 mt-1.5 min-h-[18px] font-body text-[12px]",
          error ? "text-[var(--status-negative)]" : "text-[var(--ink-secondary)]"
        )}
      >
        {error ?? help ?? ""}
      </p>
    </div>
  )
}
