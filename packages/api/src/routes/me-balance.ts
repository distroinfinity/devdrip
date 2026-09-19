import { Router } from "express"
import { getBalance } from "../services/balance.service.js"
import { bumpMockBalance, getMockBalance } from "../services/mock-earnings.js"

export const meBalanceRouter: ReturnType<typeof Router> = Router()

// /me/balance — overlays the demo-only mock balance on top of the real
// earnings_ledger sum so the Mini App balance counter ticks in real time
// while the CLI's terminal toasts fire. Mock store is in-process; resets
// on API restart.
meBalanceRouter.get("/", async (_req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const balance = await getBalance(userId)
    const mock = getMockBalance(userId)
    res.json({
      availableUsdc: balance.availableUsdc + mock,
      lifetimeEarnedUsdc: balance.lifetimeEarnedUsdc + mock,
      pendingPayoutsUsdc: balance.pendingPayoutsUsdc,
    })
  } catch (err) {
    next(err)
  }
})

// Demo helper. CLI daemon POSTs here after each completed impression so the
// Mini App's polling balance card sees a synchronized increment. Auth uses
// the same Bearer-or-cookie middleware as /me/balance.
meBalanceRouter.post("/mock-earn", async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const { amount_usdc } = req.body as { amount_usdc?: unknown }
    const amt = typeof amount_usdc === "number" ? amount_usdc : Number(amount_usdc)
    if (!Number.isFinite(amt) || amt <= 0 || amt > 1) {
      res.status(400).json({ error: "invalid_amount" })
      return
    }
    const total = bumpMockBalance(userId, amt)
    res.json({ ok: true, mockTotalUsdc: total })
  } catch (err) {
    next(err)
  }
})
