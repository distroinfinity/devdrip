import { Router } from "express"
import { compareSemver } from "../lib/semver.js"

export const cliVersionRouter: ReturnType<typeof Router> = Router()

const TARBALL_BASE = "https://github.com/distroinfinity/devdrip/releases/download/cli-v"

cliVersionRouter.get("/version-check", (req, res) => {
  const current = typeof req.query["current"] === "string" ? req.query["current"].trim() : ""
  if (!current) {
    res.status(400).json({ error: "missing_current" })
    return
  }

  const latest = process.env["LATEST_CLI_VERSION"] ?? ""

  // kill-switch: env not set → don't advertise any update
  if (!latest) {
    res.json({ latest: current, outdated: false, tarballUrl: "" })
    return
  }

  const outdated = compareSemver(current, latest) < 0
  const tarballUrl = `${TARBALL_BASE}${latest}/distrotv-cli.tar.gz`

  res.json({ latest, outdated, tarballUrl })
})
