// ── base error ──────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    public details?: Record<string, unknown>
  ) {
    super(errorCode)
    this.name = "ApiError"
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.errorCode,
      ...(this.details && Object.keys(this.details).length > 0 ? this.details : {}),
    }
  }
}

// ── 400 — input validation ──────────────────────────────────────────────────

export class ValidationError extends ApiError {
  constructor(errorCode: string) {
    super(400, errorCode)
    this.name = "ValidationError"
  }
}

// ── 403 — forbidden ─────────────────────────────────────────────────────────

export class ForbiddenError extends ApiError {
  constructor(errorCode = "forbidden") {
    super(403, errorCode)
    this.name = "ForbiddenError"
  }
}

// ── 404 — not found ─────────────────────────────────────────────────────────

export class NotFoundError extends ApiError {
  constructor(entity: string) {
    super(404, `${entity}_not_found`)
    this.name = "NotFoundError"
  }
}

// ── 409 — conflict ──────────────────────────────────────────────────────────

export class ConflictError extends ApiError {
  constructor(errorCode: string, details?: Record<string, unknown>) {
    super(409, errorCode, details)
    this.name = "ConflictError"
  }
}

// ── 422 — state / business rule violation ───────────────────────────────────

export class StateError extends ApiError {
  constructor(errorCode: string, details?: Record<string, unknown>) {
    super(422, errorCode, details)
    this.name = "StateError"
  }
}

// ── pg error code extractor ─────────────────────────────────────────────────

export function pgErrorCode(err: unknown): string | undefined {
  const e = err as { code?: string; cause?: { code?: string } }
  return e.code ?? e.cause?.code
}
