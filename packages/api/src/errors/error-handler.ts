import type { Request, Response, NextFunction } from "express"
import { ApiError, pgErrorCode } from "./index.js"
import { logger } from "../lib/logger.js"

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
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

  // unknown error — log and return generic 500
  logger.error({ err }, "unhandled error")
  res.status(500).json({ error: "internal_error" })
}
