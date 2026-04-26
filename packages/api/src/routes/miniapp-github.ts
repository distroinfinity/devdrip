import { Router } from "express"
import { requireMiniAppSession } from "../middleware/miniapp-auth.js"
import {
  mintGithubOauthState,
  buildGithubAuthorizeUrl,
  consumeGithubOauthState,
  bindGithubIdentityToMiniAppUser,
} from "../services/miniapp-github.service.js"
import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"

export const miniappGithubRouter: ReturnType<typeof Router> = Router()

// Initiates the OAuth flow. Mini App opens this URL in the World App in-app
// browser; on success GitHub redirects back to /miniapp/github-oauth/callback.
miniappGithubRouter.get("/start", requireMiniAppSession, async (_req, res, next) => {
  try {
    const userId = res.locals["miniAppUserId"] as string
    const state = await mintGithubOauthState(userId)
    res.redirect(buildGithubAuthorizeUrl(state))
  } catch (err) {
    next(err)
  }
})

// Callback runs in the in-app browser. We don't have the Mini App cookie here
// because GitHub's User-Agent doesn't carry it back — we rely on the state
// parameter to recover the user_id, then redirect back into the Mini App.
miniappGithubRouter.get("/callback", async (req, res) => {
  const { code, state, error } = req.query
  if (typeof error === "string" && error) {
    return res.redirect(`${env.miniAppBaseUrl}/m/signup?error=${encodeURIComponent(error)}`)
  }
  if (typeof code !== "string" || typeof state !== "string") {
    return res.redirect(`${env.miniAppBaseUrl}/m/signup?error=missing_code_or_state`)
  }
  const userId = await consumeGithubOauthState(state)
  if (!userId) {
    return res.redirect(`${env.miniAppBaseUrl}/m/signup?error=invalid_state`)
  }
  try {
    await bindGithubIdentityToMiniAppUser(userId, code)
    res.redirect(`${env.miniAppBaseUrl}/m/signup?step=done`)
  } catch (err) {
    logger.error({ err }, "miniapp github oauth callback bind failed")
    res.redirect(`${env.miniAppBaseUrl}/m/signup?error=github_bind_failed`)
  }
})
