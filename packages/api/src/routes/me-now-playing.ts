import { Router, type Request, type Response, type NextFunction } from "express"
import { ValidationError } from "../errors/index.js"
import { getNowPlaying, setNowPlaying, clearNowPlaying } from "../services/now-playing.service.js"

export const meNowPlayingRouter: ReturnType<typeof Router> = Router({ mergeParams: true })

meNowPlayingRouter.get(
  "/",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const deviceId = req.params.id
      const dto = await getNowPlaying(deviceId)
      res.json(dto)
    } catch (err) {
      next(err)
    }
  }
)

meNowPlayingRouter.put(
  "/",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const deviceId = req.params.id
      const body = req.body as {
        kind?: unknown
        payload?: unknown
        startedAt?: unknown
        endsAt?: unknown
      }
      const kind = body.kind
      if (kind !== "news" && kind !== "ticker" && kind !== "alert") {
        throw new ValidationError("invalid_kind")
      }
      const startedAt = body.startedAt
      const endsAt = body.endsAt
      if (typeof startedAt !== "string" || typeof endsAt !== "string") {
        throw new ValidationError("invalid_timestamps")
      }
      await setNowPlaying(deviceId, { kind, payload: body.payload ?? null, startedAt, endsAt })
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  }
)

meNowPlayingRouter.delete(
  "/",
  async (req: Request<{ id: string }>, res: Response, next: NextFunction) => {
    try {
      const deviceId = req.params.id
      await clearNowPlaying(deviceId)
      res.status(204).end()
    } catch (err) {
      next(err)
    }
  }
)
