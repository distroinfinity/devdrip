import type { Request, Response, NextFunction } from "express"
import { ApiError, pgErrorCode } from "./index.js"
import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"

function isDev(): boolean {
  return env.nodeEnv !== "production"
}

// Pull a useful shape out of anything that comes in here. Unknown errors
// (Error subclasses, pg driver errors with { code, detail }, thrown strings)
// all get normalised the same way.
function serializeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      name: err.name,
      message: err.message,
      stack: err.stack,
    }
    const withCode = err as Error & { code?: unknown; detail?: unknown; cause?: unknown }
    if (withCode.code !== undefined) out["code"] = withCode.code
    if (withCode.detail !== undefined) out["detail"] = withCode.detail
    if (withCode.cause !== undefined) out["cause"] = String(withCode.cause)
    return out
  }
  return { value: String(err) }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  // known application errors — serialized directly
  if (err instanceof ApiError) {
    res.status(err.statusCode).json(err.toJSON())
    return
  }

  // pg unique constraint violation
  if (pgErrorCode(err) === "23505") {
    res.status(409).json({ error: "duplicate_key" })
    return
  }

  // pg foreign key violation
  if (pgErrorCode(err) === "23503") {
    res.status(409).json({ error: "foreign_key_constraint" })
    return
  }

  // pg check constraint violation
  if (pgErrorCode(err) === "23514") {
    res.status(400).json({ error: "check_constraint_violated" })
    return
  }

  // unknown error → log everywhere we can, then respond
  const serialized = serializeError(err)

  // Safety net: write directly to stderr so a silently-buffered pino
  // transport can't hide the failure during dev. `console.error`
  // is synchronous and doesn't go through the logger transport.
  if (isDev()) {
    console.error(`\n[error-handler] ${req.method} ${req.originalUrl} → 500\n`, serialized)
  }

  logger.error({ err: serialized, method: req.method, url: req.originalUrl }, "unhandled error")

  // In dev, surface the real error back to the client so the CLI / curl
  // caller sees why. Prod keeps the opaque "internal_error" to avoid
  // leaking stack traces.
  if (isDev()) {
    res.status(500).json({
      error: "internal_error",
      message: typeof serialized["message"] === "string" ? serialized["message"] : undefined,
      name: typeof serialized["name"] === "string" ? serialized["name"] : undefined,
      code: serialized["code"],
      stack: typeof serialized["stack"] === "string" ? serialized["stack"] : undefined,
    })
    return
  }

  res.status(500).json({ error: "internal_error" })
}
