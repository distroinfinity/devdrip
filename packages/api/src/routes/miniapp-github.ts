import { Router } from "express"
import { requireMiniAppSession } from "../middleware/miniapp-auth.js"
import {
  mintGithubOauthState,
  buildGithubAuthorizeUrl,
  consumeGithubOauthState,
  bindGithubIdentityToMiniAppUser,
  mintResumeCode,
  consumeResumeCode,
} from "../services/miniapp-github.service.js"
import { setMiniAppCookie } from "./miniapp-auth.js"
import { signMiniAppSession } from "../lib/miniapp-jwt.js"
import { env } from "../config/env.js"
import { logger } from "../lib/logger.js"

export const miniappGithubRouter: ReturnType<typeof Router> = Router()

// Initiates the OAuth flow. Mini App opens this URL in the World App in-app
// browser; on success GitHub redirects back to /miniapp/github-oauth/callback.
// We bake any active CLI-link code into the OAuth state so the post-callback
// redirect can put the user back on the LinkCliCard instead of the wallet.
miniappGithubRouter.get("/start", requireMiniAppSession, async (req, res, next) => {
  try {
    const userId = res.locals["miniAppUserId"] as string
    const linkCode = typeof req.query["link"] === "string" ? req.query["link"] : undefined
    const state = await mintGithubOauthState({ userId, linkCode })
    res.redirect(buildGithubAuthorizeUrl(state))
  } catch (err) {
    next(err)
  }
})

// Callback flow on iOS:
//   1. World App's in-app WebView opens GitHub OAuth in a separate browser
//      (Safari / SFSafariViewController / fresh WebView). When GitHub redirects
//      back, the callback runs in THAT browser, not in World App's WebView.
//   2. iOS WebViews have isolated cookie jars per WebView instance, so any
//      cookie we set on the callback response lives in the wrong jar — World
//      App's WebView can't read it.
//   3. To bridge: mint a one-time `resume` code, embed it in the world.org
//      universal-link deeplink, and bounce the user back into World App. The
//      Mini App page calls /miniapp/signup-resume to swap the resume code for
//      a fresh dd_miniapp cookie set INSIDE World App's WebView.
function deeplinkResume(resume: string): string {
  const path = `/m/signup-resume?code=${encodeURIComponent(resume)}`
  return `https://world.org/mini-app?app_id=${env.worldAppId}&path=${encodeURIComponent(path)}`
}

function bridgeHtml(targetUrl: string, message: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Return to World App</title>
<style>
  body { font: 16px/1.5 -apple-system, system-ui, sans-serif; background:#0a0a0c; color:#ededf0; margin:0; padding:24px; min-height:100vh; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:24px; text-align:center; }
  a { background:#6366f1; color:#fff; padding:14px 24px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block; }
  p { max-width:32ch; color:#8a8a94; }
</style>
<meta http-equiv="refresh" content="0; url=${targetUrl}">
</head><body>
<p>${message}</p>
<a href="${targetUrl}">Return to World App</a>
<script>setTimeout(function(){ window.location.replace(${JSON.stringify(targetUrl)}); }, 50);</script>
</body></html>`
}

function buildErrorReturn(error: string): string {
  const params = new URLSearchParams({ error })
  return `${env.miniAppBaseUrl}/m/signup?${params}`
}

miniappGithubRouter.get("/callback", async (req, res) => {
  const { code, state, error } = req.query
  if (typeof error === "string" && error) {
    return res.send(bridgeHtml(buildErrorReturn(error), "GitHub sign-in cancelled — returning…"))
  }
  if (typeof code !== "string" || typeof state !== "string") {
    return res.send(
      bridgeHtml(buildErrorReturn("missing_code_or_state"), "Missing OAuth params — returning…")
    )
  }
  const stateData = await consumeGithubOauthState(state)
  if (!stateData) {
    return res.send(bridgeHtml(buildErrorReturn("invalid_state"), "Session expired — returning…"))
  }
  try {
    await bindGithubIdentityToMiniAppUser(stateData.userId, code)
    // Mint a one-time resume code that the Mini App will exchange for a
    // session cookie inside World App's WebView.
    const resume = await mintResumeCode({
      userId: stateData.userId,
      linkCode: stateData.linkCode,
    })
    res.send(bridgeHtml(deeplinkResume(resume), "GitHub connected — returning to DevDrip…"))
  } catch (err) {
    logger.error({ err }, "miniapp github oauth callback bind failed")
    res.send(
      bridgeHtml(buildErrorReturn("github_bind_failed"), "Could not link GitHub — returning…")
    )
  }
})

// Exchange a resume code (from the OAuth bridge) for a fresh dd_miniapp cookie.
// Called by /m/signup-resume in World App's WebView, so the Set-Cookie lands
// in the right jar.
miniappGithubRouter.post("/resume", async (req, res, next) => {
  try {
    const { code } = req.body as { code?: unknown }
    if (typeof code !== "string" || !/^[0-9a-f]{32}$/.test(code)) {
      res.status(400).json({ error: "invalid_resume_code" })
      return
    }
    const data = await consumeResumeCode(code)
    if (!data) {
      res.status(410).json({ error: "resume_code_expired" })
      return
    }
    const token = await signMiniAppSession({ sub: data.userId, signup: true }, env.jwtSecret)
    setMiniAppCookie(res, token)
    res.json({ link_code: data.linkCode ?? null })
  } catch (err) {
    next(err)
  }
})
