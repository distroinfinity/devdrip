"use client"

import { useState, useTransition, useId } from "react"
import type { OnchainPosition, PoolSnapshot } from "@/lib/dashboard-api"
import { EmptyState } from "@/components/v5/empty-state"
import { SectionRule } from "@/components/v5/section-rule"
import { SharpInput } from "@/components/v5/sharp-input"
import { SharpButton } from "@/components/v5/sharp-button"
import { registerPosition, stopWatchingPosition } from "./actions"

const POOL_ID_RE = /^0x[0-9a-fA-F]{64}$/
const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/
const XLAYER_TESTNET = 1952

function shortAddr(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a
}

// feeBps / volBps are basis points (1 bp = 0.01%)
function bpsToPct(bps: number): string {
  return `${(bps / 100).toFixed(2)}%`
}

interface Props {
  initial: OnchainPosition[]
  snapshot: PoolSnapshot | null
  demoPoolId: string
}

export function OnchainClient({ initial, snapshot, demoPoolId }: Props) {
  const [positions, setPositions] = useState<OnchainPosition[]>(initial)
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // register form state — poolId prefilled to the demo pool
  const [label, setLabel] = useState("")
  const [poolId, setPoolId] = useState(demoPoolId)
  const [tickLower, setTickLower] = useState("")
  const [tickUpper, setTickUpper] = useState("")
  const [walletAddress, setWalletAddress] = useState("")
  const formId = useId()

  const liveTick = snapshot?.tick ?? null

  function inRange(p: OnchainPosition): boolean | null {
    if (liveTick === null) return null
    return liveTick >= p.tickLower && liveTick < p.tickUpper
  }

  function add(e: React.FormEvent) {
    e.preventDefault()
    const lower = Number(tickLower)
    const upper = Number(tickUpper)

    if (!POOL_ID_RE.test(poolId.trim())) {
      setError("pool id must be a 0x… 64-hex string")
      return
    }
    if (!ADDRESS_RE.test(walletAddress.trim())) {
      setError("wallet must be a 0x… 40-hex address")
      return
    }
    if (
      !Number.isInteger(lower) ||
      !Number.isInteger(upper) ||
      tickLower === "" ||
      tickUpper === ""
    ) {
      setError("ticks must be integers")
      return
    }
    if (lower >= upper) {
      setError("tickLower must be below tickUpper")
      return
    }

    start(async () => {
      const result = await registerPosition({
        chainId: XLAYER_TESTNET,
        poolId: poolId.trim(),
        tickLower: lower,
        tickUpper: upper,
        walletAddress: walletAddress.trim(),
        label: label.trim() || undefined,
      })
      if (result.ok && result.position) {
        setPositions((cur) => [result.position as OnchainPosition, ...cur])
        setLabel("")
        setTickLower("")
        setTickUpper("")
        setWalletAddress("")
        setError(null)
      } else {
        setError(result.error ?? "register failed")
      }
    })
  }

  function remove(id: string) {
    const prev = positions
    setPositions((cur) => cur.filter((p) => p.id !== id))
    setError(null)
    start(async () => {
      const result = await stopWatchingPosition(id)
      if (!result.ok) {
        setPositions(prev)
        setError(result.error ?? "couldn't stop watching — try again")
      }
    })
  }

  return (
    <div className="flex flex-col gap-8">
      {/* ── live pool panel — dynamic fee is the hero ── */}
      <section className="border border-[var(--rule-default)] bg-[var(--bg-surface)] p-5">
        <div className="flex items-center justify-between">
          <span className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
            Live Pool
          </span>
          {snapshot ? (
            <span className="inline-flex items-center gap-1.5 font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--color-forest,#2F8F4E)]" />
              {snapshot.poolLabel}
            </span>
          ) : (
            <span className="font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)]">
              snapshot unavailable
            </span>
          )}
        </div>

        {snapshot ? (
          <>
            {/* hero: dynamic fee */}
            <div className="mt-4 flex items-baseline gap-3">
              <span className="font-display text-[56px] font-bold leading-none tracking-[-0.03em] text-[var(--accent-color)] md:text-[72px] tabular-nums">
                {bpsToPct(snapshot.feeBps)}
              </span>
              <span className="font-body text-[12px] text-[var(--ink-secondary)]">dynamic fee</span>
            </div>
            <p className="mt-1 font-[var(--font-data)] text-[11px] text-[var(--ink-tertiary)]">
              rises with volatility — {bpsToPct(snapshot.volBps)} vol right now
            </p>

            {/* secondary stats */}
            <div className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-4">
              <Stat
                label="price"
                value={snapshot.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}
              />
              <Stat label="tick" value={String(snapshot.tick)} />
              <Stat label="fee" value={bpsToPct(snapshot.feeBps)} />
              <Stat label="vol" value={bpsToPct(snapshot.volBps)} />
            </div>

            <p className="mt-5 font-[var(--font-data)] text-[10px] text-[var(--ink-faint)]">
              as of {new Date(snapshot.asOf).toLocaleString()}
            </p>
          </>
        ) : (
          <p className="mt-4 font-body text-[13px] text-[var(--ink-secondary)]">
            couldn&apos;t read the on-chain snapshot. positions still load below — try a refresh.
          </p>
        )}
      </section>

      {/* ── positions list ── */}
      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
            Watched Positions
          </h2>
          {positions.length > 0 && (
            <span className="font-[var(--font-data)] text-[11px] text-[var(--ink-tertiary)] tabular-nums">
              {positions.length}
            </span>
          )}
        </div>

        {error && (
          <p className="mt-3 font-[var(--font-data)] text-[11px] text-[var(--color-oxblood,#C13438)]">
            {error}
          </p>
        )}

        {positions.length === 0 ? (
          <EmptyState
            title="no positions watched"
            body="register an lp position below to get a guard slot in your terminal when price approaches a range edge"
          />
        ) : (
          <div className="mt-3 flex flex-col">
            {positions.map((p) => {
              const ir = inRange(p)
              return (
                <div
                  key={p.id}
                  className="group flex items-center gap-3 border-b border-[var(--rule-default)] py-3 last:border-b-0"
                >
                  {/* label */}
                  <span className="w-[140px] shrink-0 truncate font-[var(--font-data)] text-[12px] font-bold tracking-[0.02em] text-[var(--ink-primary)]">
                    {p.label || "untitled"}
                  </span>

                  {/* range */}
                  <span className="w-[140px] shrink-0 font-[var(--font-data)] text-[11px] tabular-nums text-[var(--ink-secondary)]">
                    {p.tickLower} → {p.tickUpper}
                  </span>

                  {/* wallet */}
                  <span className="hidden shrink-0 font-[var(--font-data)] text-[11px] text-[var(--ink-tertiary)] sm:inline">
                    {shortAddr(p.walletAddress)}
                  </span>

                  <div className="flex-1" />

                  {/* in/out of range vs live tick */}
                  {ir === null ? (
                    <span className="shrink-0 font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)]">
                      no live tick
                    </span>
                  ) : (
                    <span
                      className="shrink-0 border px-2 py-0.5 font-[var(--font-data)] text-[10px] uppercase tracking-[0.06em]"
                      style={{
                        color: ir
                          ? "var(--color-forest, #2F8F4E)"
                          : "var(--color-oxblood, #C13438)",
                        borderColor: ir
                          ? "var(--color-forest, #2F8F4E)"
                          : "var(--color-oxblood, #C13438)",
                      }}
                    >
                      {ir ? "in range" : "out of range"}
                    </span>
                  )}

                  {/* stop watching */}
                  <button
                    type="button"
                    onClick={() => remove(p.id)}
                    disabled={pending}
                    aria-label={`stop watching ${p.label || p.id}`}
                    className="shrink-0 whitespace-nowrap border border-[var(--rule-default)] px-2 py-0.5 font-[var(--font-data)] text-[10px] text-[var(--ink-tertiary)] opacity-0 transition-all hover:border-[var(--color-oxblood,#C13438)] hover:text-[var(--color-oxblood,#C13438)] group-hover:opacity-100 disabled:opacity-30"
                  >
                    stop watching
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </section>

      <SectionRule />

      {/* ── register form ── */}
      <section>
        <h2 className="font-display text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--ink-tertiary)]">
          Register Position
        </h2>
        <form onSubmit={add} className="mt-4 flex flex-col gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="label" htmlFor={`${formId}-label`}>
              <SharpInput
                id={`${formId}-label`}
                type="text"
                placeholder="my mWETH/mUSDC range"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                disabled={pending}
                className="w-full text-[12px] font-[var(--font-data)]"
              />
            </Field>
            <Field label="wallet address" htmlFor={`${formId}-wallet`}>
              <SharpInput
                id={`${formId}-wallet`}
                type="text"
                placeholder="0x… (40 hex)"
                value={walletAddress}
                onChange={(e) => setWalletAddress(e.target.value)}
                disabled={pending}
                className="w-full text-[12px] font-[var(--font-data)]"
              />
            </Field>
          </div>

          <Field label="pool id" htmlFor={`${formId}-pool`}>
            <SharpInput
              id={`${formId}-pool`}
              type="text"
              placeholder="0x… (64 hex)"
              value={poolId}
              onChange={(e) => setPoolId(e.target.value)}
              disabled={pending}
              className="w-full text-[12px] font-[var(--font-data)]"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="tick lower" htmlFor={`${formId}-lower`}>
              <SharpInput
                id={`${formId}-lower`}
                type="number"
                inputMode="numeric"
                placeholder="-887220"
                value={tickLower}
                onChange={(e) => setTickLower(e.target.value)}
                disabled={pending}
                className="w-full text-[12px] font-[var(--font-data)]"
              />
            </Field>
            <Field label="tick upper" htmlFor={`${formId}-upper`}>
              <SharpInput
                id={`${formId}-upper`}
                type="number"
                inputMode="numeric"
                placeholder="887220"
                value={tickUpper}
                onChange={(e) => setTickUpper(e.target.value)}
                disabled={pending}
                className="w-full text-[12px] font-[var(--font-data)]"
              />
            </Field>
          </div>

          <div className="flex items-center gap-3">
            <SharpButton type="submit" disabled={pending} className="text-[12px]">
              {pending ? "registering…" : "register position"}
            </SharpButton>
            <span className="font-[var(--font-data)] text-[10px] text-[var(--ink-faint)]">
              x layer testnet · chainId {XLAYER_TESTNET}
            </span>
          </div>
        </form>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="font-[var(--font-data)] text-[10px] uppercase tracking-[0.1em] text-[var(--ink-tertiary)]">
        {label}
      </p>
      <p className="mt-1 font-[var(--font-data)] text-[15px] font-bold tabular-nums text-[var(--ink-primary)]">
        {value}
      </p>
    </div>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1.5">
      <span className="font-[var(--font-data)] text-[10px] uppercase tracking-[0.1em] text-[var(--ink-tertiary)]">
        {label}
      </span>
      {children}
    </label>
  )
}
