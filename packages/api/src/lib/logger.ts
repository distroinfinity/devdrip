import pino from "pino"
import { env } from "../config/env.js"

export const logger = pino({
  level: env.nodeEnv === "production" ? "info" : "debug",
  base: { service: "api", env: env.nodeEnv },
  ...(env.nodeEnv !== "production" && {
    transport: { target: "pino-pretty", options: { colorize: true } },
  }),
})
