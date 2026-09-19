# distro init

`distro init` is the onboarding wizard. After the github-oauth cutover (2026-05-22) it requires GitHub sign-in before any other setup runs.

## Flow

1. **Existing device probe.** If `~/.distro/config.json` already has a `device.secret`, the wizard probes `GET /me`. If the token is still valid, it skips OAuth and jumps straight to the prefs picker.
2. **Pair-code request.** Otherwise it calls `POST /devices/pair-init` (public) → `{ code, setupUrl }`.
3. **Open the browser.** `open` is called on `setupUrl` (mac/linux/win). With `--no-browser` or if `open` fails, the URL + pair code are printed in an ASCII-boxed message so the user can paste it into a browser on any device.
4. **Long-poll.** The CLI hits `GET /devices/pair-poll?code=<code>` in a loop. The endpoint long-polls up to ~25 s per request and returns 204 while pending, 200 once ready, 410 once expired (10-min total TTL).
5. **GitHub OAuth (in the browser).** `/setup?pair=<code>` shows a "Continue with GitHub" button → `/auth/github/start?pair=<code>` → github.com → callback. The dashboard's `/auth/github/callback` route binds the pair → device → user via `POST /auth/github/complete` (s2s).
6. **Persist.** Once `pair-poll` returns ready, the CLI writes `{ user, device }` into `~/.distro/config.json`.
7. **Onboarding continues.** Channel-mode picker, channels picker, watchlist picker, hooks install, daemon start, slot preview. All run _after_ sign-in completes — no anonymous path.

## Headless / SSH

```sh
distro init --no-browser
```

prints the `setupUrl` and pair code; finish OAuth in a browser on any device. The pair code is short-lived (10 min) but you can re-run `distro init` if it expires.

## Sign out

`distro logout` clears the local config and revokes the device on the backend. After logout, re-running `distro init` starts a fresh OAuth round.

## Failure modes

| Symptom                              | Cause                                               | Fix                             |
| ------------------------------------ | --------------------------------------------------- | ------------------------------- |
| `sign-in took too long`              | Pair-code TTL elapsed before OAuth completed        | Re-run `distro init`            |
| `device unknown` on subsequent calls | Device deleted on backend (e.g. via `/admin/users`) | Re-run `distro init`            |
| `pair_init_failed`                   | Redis down on the API                               | Wait + retry; check API status  |
| `oauth_user_denied`                  | User cancelled on github.com                        | Re-click "Continue with GitHub" |
