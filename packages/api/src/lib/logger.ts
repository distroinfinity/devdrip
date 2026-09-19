import pino from "pino"
import { env } from "../config/env.js"

// sync: true on the transport forces pino-pretty to flush each record inline
// instead of buffering in a worker thread. without it, errors logged during
// a request can sit in the worker's queue indefinitely when traffic is low —
// which made real 500s invisible during local dev.
export const logger = pino({
  level: env.nodeEnv === "production" ? "info" : "debug",
  base: { service: "api", env: env.nodeEnv },
  ...(env.nodeEnv !== "production" && {
    transport: {
      target: "pino-pretty",
      options: { colorize: true, sync: true },
    },
  }),
})
