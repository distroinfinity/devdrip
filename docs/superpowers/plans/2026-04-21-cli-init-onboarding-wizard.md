# devdrip init onboarding wizard — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `devdrip init` — a 7-step wizard that turns a fresh machine into a working DevDrip install (OAuth, device register, category prefs, hook merge into `~/.claude/settings.json`, real ad preview from the existing Carbon→manual waterfall, inline health check).

**Architecture:** Orchestrator command (`init.ts`) wiring together pure-function modules (`claude-settings.ts` for hook merge, `render-box.ts` for ASCII ad card, `health.ts` for the four-probe mini-doctor) and a small backend addition (`PUT /me/preferences`). Config schema bumps to v2 with new `device.id` and `cli.binPath` fields, migrated on read.

**Tech Stack:** TypeScript, Node 20, pnpm workspaces, Commander, @clack/prompts (new), vitest, Drizzle ORM, Express. Spec: `docs/superpowers/specs/2026-04-21-cli-init-onboarding-wizard-design.md`.

---

## File map

**Backend (new/modified):**

- `packages/api/src/validators/preferences.validators.ts` — new
- `packages/api/src/routes/me-preferences.ts` — new
- `packages/api/src/app.ts` — register new route
- `packages/api/src/__tests__/me-preferences.test.ts` — new

**CLI (new):**

- `packages/cli/vitest.config.ts` — new (CLI has no tests today)
- `packages/cli/src/lib/render-box.ts` — new
- `packages/cli/src/lib/claude-settings.ts` — new
- `packages/cli/src/lib/preferences-client.ts` — new
- `packages/cli/src/lib/health.ts` — new
- `packages/cli/src/lib/__tests__/render-box.test.ts` — new
- `packages/cli/src/lib/__tests__/claude-settings.test.ts` — new
- `packages/cli/src/lib/__tests__/health.test.ts` — new
- `packages/cli/src/lib/__tests__/config-migration.test.ts` — new
- `packages/cli/src/commands/__tests__/init.test.ts` — new

**CLI (modified):**

- `packages/cli/package.json` — add `@clack/prompts`, vitest deps
- `packages/cli/src/lib/config.ts` — bump CONFIG_VERSION to 2, add device + cli fields, migration
- `packages/cli/src/commands/init.ts` — placeholder → full wizard
- `packages/cli/src/commands/demo.ts` — placeholder → one-shot fetch + render

**Docs:**

- `gitbook-docs/cli/current-state.md` — add `devdrip init` + `devdrip demo` sections
- `gitbook-docs/backend/api.md` — document `PUT /me/preferences`

---

## Task 1: Backend — preferences validator

**Files:**

- Create: `packages/api/src/validators/preferences.validators.ts`

Stand-alone pure validator. Uses the existing `validators/common.ts` helpers (same style as `ad.validators.ts`).

- [ ] **Step 1.1: Create the validator file**

```typescript
// packages/api/src/validators/preferences.validators.ts
import { AdCategory } from "@devdrip/shared"
import { ValidationError } from "../errors/index.js"
import { requireBody, validateEnumArray } from "./common.js"

const AD_CATEGORIES = Object.values(AdCategory) as string[]

export interface UpdatePreferencesInput {
  blockedCategories?: AdCategory[]
  tzOffsetMinutes?: number
}

const ALLOWED_KEYS = new Set(["blockedCategories", "tzOffsetMinutes"])

export function validateUpdatePreferences(body: unknown): UpdatePreferencesInput {
  const b = requireBody(body)

  for (const k of Object.keys(b)) {
    if (!ALLOWED_KEYS.has(k)) throw new ValidationError("unknown_field")
  }

  const out: UpdatePreferencesInput = {}

  if (b["blockedCategories"] !== undefined) {
    const arr = validateEnumArray(b["blockedCategories"], AD_CATEGORIES, "blocked_categories")
    out.blockedCategories = arr as AdCategory[]
  }

  if (b["tzOffsetMinutes"] !== undefined) {
    const v = b["tzOffsetMinutes"]
    if (typeof v !== "number" || !Number.isInteger(v) || v < -720 || v > 840) {
      throw new ValidationError("invalid_tz_offset_minutes")
    }
    out.tzOffsetMinutes = v
  }

  return out
}
```

- [ ] **Step 1.2: Typecheck**

Run: `pnpm --filter @devdrip/api typecheck`
Expected: no errors.

- [ ] **Step 1.3: Commit**

```bash
git add packages/api/src/validators/preferences.validators.ts
git commit -m "S2-07: add preferences update validator"
```

---

## Task 2: Backend — `PUT /me/preferences` route

**Files:**

- Create: `packages/api/src/routes/me-preferences.ts`
- Modify: `packages/api/src/app.ts`

- [ ] **Step 2.1: Create the route handler**

```typescript
// packages/api/src/routes/me-preferences.ts
import { Router } from "express"
import { eq, sql } from "drizzle-orm"
import { getDb } from "../db/index.js"
import { preferences } from "../db/schema/preferences.js"
import { validateUpdatePreferences } from "../validators/preferences.validators.js"
import { userLimiter } from "../middleware/rate-limit.js"

export const mePreferencesRouter: ReturnType<typeof Router> = Router()

mePreferencesRouter.put("/preferences", userLimiter, async (req, res, next) => {
  try {
    const userId = res.locals["userId"] as string
    const input = validateUpdatePreferences(req.body)

    const db = getDb()

    const insertValues: Record<string, unknown> = { userId }
    const updateSet: Record<string, unknown> = { updatedAt: sql`now()` }
    if (input.blockedCategories !== undefined) {
      insertValues["blockedCategories"] = input.blockedCategories
      updateSet["blockedCategories"] = input.blockedCategories
    }
    if (input.tzOffsetMinutes !== undefined) {
      insertValues["tzOffsetMinutes"] = input.tzOffsetMinutes
      updateSet["tzOffsetMinutes"] = input.tzOffsetMinutes
    }

    await db
      .insert(preferences)
      .values(insertValues as typeof preferences.$inferInsert)
      .onConflictDoUpdate({ target: preferences.userId, set: updateSet })

    const [row] = await db.select().from(preferences).where(eq(preferences.userId, userId))
    if (!row) {
      res.status(500).json({ error: "internal_error" })
      return
    }

    res.json({
      preferences: {
        blockedCategories: row.blockedCategories,
        enabledSurfaces: row.enabledSurfaces,
        maxPerHour: row.maxPerHour,
        maxPerDay: row.maxPerDay,
        quietHoursStart: row.quietHoursStart,
        quietHoursEnd: row.quietHoursEnd,
        tzOffsetMinutes: row.tzOffsetMinutes,
        idleSensitivityMs: row.idleSensitivityMs,
      },
    })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 2.2: Wire route into app**

Open `packages/api/src/app.ts`. Near the other route registrations (look for `app.get("/me", ...)` — roughly line 67), add the `me-preferences` router mounted at `/me`, protected by `requireAuth`:

Add import at the top alongside other route imports:

```typescript
import { mePreferencesRouter } from "./routes/me-preferences.js"
```

Add router registration after the `/me` GET handler block (i.e., near the existing `app.get("/me", requireAuth, userLimiter, ...)` route):

```typescript
app.use("/me", requireAuth, mePreferencesRouter)
```

- [ ] **Step 2.3: Typecheck**

Run: `pnpm --filter @devdrip/api typecheck`
Expected: no errors.

- [ ] **Step 2.4: Commit**

```bash
git add packages/api/src/routes/me-preferences.ts packages/api/src/app.ts
git commit -m "S2-07: add PUT /me/preferences endpoint"
```

---

## Task 3: Backend — route integration test

**Files:**

- Create: `packages/api/src/__tests__/me-preferences.test.ts`

Follows the pattern in `ads-routes.test.ts` — mocked DB, supertest against the real app, signed JWT via existing helper.

- [ ] **Step 3.1: Write the test file**

```typescript
// packages/api/src/__tests__/me-preferences.test.ts
import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

process.env["JWT_SECRET"] = "test-secret-that-is-long-enough-for-hs256-signing-purposes"
process.env["ALLOWED_ORIGINS"] = "http://localhost:3000"

const mockInsertReturning = vi.fn().mockResolvedValue([])
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockReturnValue({
    onConflictDoUpdate: vi.fn().mockReturnValue({
      returning: mockInsertReturning,
    }),
  }),
})

const mockSelectWhere = vi.fn().mockResolvedValue([])
const mockSelect = vi.fn().mockReturnValue({
  from: vi.fn().mockReturnValue({
    where: mockSelectWhere,
  }),
})

vi.mock("../db/index.js", () => ({
  getDb: vi.fn(() => ({
    insert: mockInsert,
    select: mockSelect,
  })),
}))

vi.mock("../lib/redis.js", () => ({
  getRedis: vi.fn(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
    pipeline: () => ({ get: vi.fn(), exec: vi.fn().mockResolvedValue([null, null]) }),
  })),
}))

vi.mock("../middleware/rate-limit.js", () => {
  const passThrough = (_req: unknown, _res: unknown, next: () => void) => next()
  return {
    globalLimiter: passThrough,
    userLimiter: passThrough,
    adminLimiter: passThrough,
    publicLimiter: passThrough,
    authLimiter: passThrough,
    refreshLimiter: passThrough,
    sensitiveLimiter: passThrough,
    advertiserLimiter: passThrough,
  }
})

import request from "supertest"
import { app } from "../app.js"
import { signAccessToken } from "../lib/jwt.js"

const TEST_USER_ID = "00000000-1111-2222-3333-444444444444"
let token: string

beforeAll(async () => {
  token = await signAccessToken(TEST_USER_ID)
})

beforeEach(() => {
  mockInsertReturning.mockReset().mockResolvedValue([])
  mockSelectWhere.mockReset().mockResolvedValue([])
})

describe("PUT /me/preferences", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await request(app).put("/me/preferences").send({ blockedCategories: [] })
    expect(res.status).toBe(401)
  })

  it("upserts blockedCategories and returns the full row", async () => {
    mockSelectWhere.mockResolvedValueOnce([
      {
        blockedCategories: ["developer-recruiting"],
        enabledSurfaces: ["terminal-tv"],
        maxPerHour: 8,
        maxPerDay: 60,
        quietHoursStart: null,
        quietHoursEnd: null,
        tzOffsetMinutes: 0,
        idleSensitivityMs: 10000,
      },
    ])

    const res = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ blockedCategories: ["developer-recruiting"] })

    expect(res.status).toBe(200)
    expect(res.body.preferences.blockedCategories).toEqual(["developer-recruiting"])
    expect(res.body.preferences.maxPerHour).toBe(8)
    expect(mockInsert).toHaveBeenCalled()
  })

  it("rejects an unknown category value", async () => {
    const res = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ blockedCategories: ["not-a-real-category"] })

    expect(res.status).toBe(400)
  })

  it("rejects unknown top-level fields", async () => {
    const res = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ blockedCategories: [], somethingElse: true })

    expect(res.status).toBe(400)
  })

  it("accepts valid tzOffsetMinutes", async () => {
    mockSelectWhere.mockResolvedValueOnce([
      {
        blockedCategories: [],
        enabledSurfaces: [],
        maxPerHour: 8,
        maxPerDay: 60,
        quietHoursStart: null,
        quietHoursEnd: null,
        tzOffsetMinutes: -330,
        idleSensitivityMs: 10000,
      },
    ])

    const res = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ tzOffsetMinutes: -330 })

    expect(res.status).toBe(200)
    expect(res.body.preferences.tzOffsetMinutes).toBe(-330)
  })

  it("rejects out-of-range tzOffsetMinutes", async () => {
    const res = await request(app)
      .put("/me/preferences")
      .set("Authorization", `Bearer ${token}`)
      .send({ tzOffsetMinutes: 9999 })

    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 3.2: Run the test — expect all 6 to pass**

Run: `pnpm --filter @devdrip/api test -- me-preferences`
Expected: 6 passing.

- [ ] **Step 3.3: Commit**

```bash
git add packages/api/src/__tests__/me-preferences.test.ts
git commit -m "S2-07: test PUT /me/preferences (unauth, upsert, validation)"
```

---

## Task 4: CLI — bump config schema to v2

**Files:**

- Modify: `packages/cli/src/lib/config.ts`
- Create: `packages/cli/vitest.config.ts`
- Create: `packages/cli/src/lib/__tests__/config-migration.test.ts`
- Modify: `packages/cli/package.json` (add vitest)

The CLI has no existing tests. This task also sets up vitest for the CLI package so every later CLI task can run tests.

- [ ] **Step 4.1: Add vitest + @clack/prompts to CLI deps**

Open `packages/cli/package.json` and add to `devDependencies`:

```json
"vitest": "^2.1.0"
```

And to `dependencies`:

```json
"@clack/prompts": "^0.9.0"
```

Also add `test` script under `scripts`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Run: `pnpm install`
Expected: installs succeed.

- [ ] **Step 4.2: Create CLI vitest config**

```typescript
// packages/cli/vitest.config.ts
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
})
```

- [ ] **Step 4.3: Write the failing migration test**

```typescript
// packages/cli/src/lib/__tests__/config-migration.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

let tempHome: string

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "devdrip-test-"))
  process.env["HOME"] = tempHome
})

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true })
})

describe("config migration", () => {
  it("reads a v1 config and returns a v2 shape with default device/cli fields", async () => {
    const dir = join(tempHome, ".devdrip")
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, "config.json"),
      JSON.stringify({
        version: 1,
        apiUrl: "http://localhost:3000",
        auth: { accessToken: "a", refreshToken: "b", accessTokenExpiresAt: "2099-01-01T00:00:00Z" },
        user: { id: "u1", githubLogin: "gh", email: "e@x.com", avatarUrl: null },
      })
    )

    const { readConfig } = await import("../config.js")
    const cfg = await readConfig()

    expect(cfg).not.toBeNull()
    expect(cfg?.version).toBe(2)
    expect(cfg?.device).toEqual({ id: null })
    expect(cfg?.cli).toEqual({ binPath: "" })
    expect(cfg?.user.githubLogin).toBe("gh")
  })

  it("reads a v2 config unchanged", async () => {
    const dir = join(tempHome, ".devdrip")
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      join(dir, "config.json"),
      JSON.stringify({
        version: 2,
        apiUrl: "http://localhost:3000",
        auth: { accessToken: "a", refreshToken: "b", accessTokenExpiresAt: "2099-01-01T00:00:00Z" },
        user: { id: "u1", githubLogin: "gh", email: "e@x.com", avatarUrl: null },
        device: { id: "dev-1" },
        cli: { binPath: "/usr/local/bin/devdrip" },
      })
    )

    const { readConfig } = await import("../config.js")
    const cfg = await readConfig()
    expect(cfg?.device?.id).toBe("dev-1")
    expect(cfg?.cli?.binPath).toBe("/usr/local/bin/devdrip")
  })

  it("returns null for a v0 or future-version config", async () => {
    const dir = join(tempHome, ".devdrip")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "config.json"), JSON.stringify({ version: 99, apiUrl: "x" }))
    const { readConfig } = await import("../config.js")
    const cfg = await readConfig()
    expect(cfg).toBeNull()
  })
})
```

- [ ] **Step 4.4: Run test — expect failures (current config version is 1)**

Run: `pnpm --filter @devdrip/cli test`
Expected: 2 failures (v1 config returns null because version !== CONFIG_VERSION; v2 test fails because types don't exist).

- [ ] **Step 4.5: Update `packages/cli/src/lib/config.ts`**

Replace the file content:

```typescript
// packages/cli/src/lib/config.ts
import { randomBytes } from "node:crypto"
import { chmod, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

export const CONFIG_VERSION = 2

export interface DevdripConfig {
  version: number
  apiUrl: string
  auth: {
    accessToken: string
    refreshToken: string
    accessTokenExpiresAt: string
  }
  user: {
    id: string
    githubLogin: string
    email: string
    avatarUrl: string | null
  }
  device: { id: string | null }
  cli: { binPath: string }
}

export function configDir(): string {
  return join(homedir(), ".devdrip")
}

export function configPath(): string {
  return join(configDir(), "config.json")
}

interface RawConfigV1 {
  version: 1
  apiUrl: string
  auth: DevdripConfig["auth"]
  user: DevdripConfig["user"]
}

function migrate(parsed: Record<string, unknown>): DevdripConfig | null {
  const version = parsed["version"]
  if (version === CONFIG_VERSION) return parsed as unknown as DevdripConfig
  if (version === 1) {
    const v1 = parsed as unknown as RawConfigV1
    return {
      version: CONFIG_VERSION,
      apiUrl: v1.apiUrl,
      auth: v1.auth,
      user: v1.user,
      device: { id: null },
      cli: { binPath: "" },
    }
  }
  return null
}

export async function readConfig(): Promise<DevdripConfig | null> {
  try {
    const raw = await readFile(configPath(), "utf8")
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return migrate(parsed)
  } catch (err) {
    if (isNotFound(err)) return null
    throw err
  }
}

export async function writeConfig(cfg: DevdripConfig): Promise<void> {
  const dir = configDir()
  const target = configPath()
  const tmp = join(dir, `.config.${randomBytes(6).toString("hex")}.tmp`)

  await mkdir(dir, { recursive: true, mode: 0o700 })
  await writeFile(tmp, JSON.stringify({ ...cfg, version: CONFIG_VERSION }, null, 2), {
    mode: 0o600,
  })
  await chmod(tmp, 0o600)
  await rename(tmp, target)
  await chmod(target, 0o600)
}

export async function deleteConfig(): Promise<boolean> {
  try {
    await rm(configPath(), { force: false })
    return true
  } catch (err) {
    if (isNotFound(err)) return false
    throw err
  }
}

export async function configExists(): Promise<boolean> {
  try {
    await stat(configPath())
    return true
  } catch (err) {
    if (isNotFound(err)) return false
    throw err
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "ENOENT"
  )
}

export function accessTokenExpiresAt(ttlSeconds = 3600, now = Date.now()): string {
  return new Date(now + ttlSeconds * 1000).toISOString()
}
```

- [ ] **Step 4.6: Update `auth.ts` to write v2 config fields**

Open `packages/cli/src/commands/auth.ts`. Find the `writeConfig(...)` call in `runLogin`. Update the object to include `device` and `cli`:

```typescript
await writeConfig({
  version: 2,
  apiUrl: baseUrl,
  auth: {
    accessToken: tokens.token,
    refreshToken: tokens.refresh_token,
    accessTokenExpiresAt: accessTokenExpiresAt(),
  },
  user: {
    id: me.id,
    githubLogin: me.githubLogin ?? "",
    email: me.email,
    avatarUrl: me.avatarUrl,
  },
  device: { id: null },
  cli: { binPath: "" },
})
```

- [ ] **Step 4.7: Run typecheck + tests**

Run: `pnpm --filter @devdrip/cli typecheck && pnpm --filter @devdrip/cli test`
Expected: 3 passing.

- [ ] **Step 4.8: Commit**

```bash
git add packages/cli/package.json packages/cli/vitest.config.ts \
        packages/cli/src/lib/config.ts \
        packages/cli/src/lib/__tests__/config-migration.test.ts \
        packages/cli/src/commands/auth.ts \
        pnpm-lock.yaml
git commit -m "S2-07: bump CLI config to v2 (device, cli.binPath) + migration"
```

---

## Task 5: CLI — `render-box` module

**Files:**

- Create: `packages/cli/src/lib/render-box.ts`
- Create: `packages/cli/src/lib/__tests__/render-box.test.ts`

Pure function. Fixed 72-col width. Unicode box chars in TTY, ASCII fallback when `NO_COLOR=1` or not a TTY.

- [ ] **Step 5.1: Write the failing test**

```typescript
// packages/cli/src/lib/__tests__/render-box.test.ts
import { describe, it, expect } from "vitest"
import { renderBox } from "../render-box.js"

const sampleAd = {
  id: "ad-1",
  campaignId: "camp-1",
  format: "text" as const,
  headline: "Vercel — ship web apps that scale",
  body: "Deploy Next.js in seconds with zero config.",
  url: "https://vercel.com",
  displayTimeMs: 8000,
  deliveryToken: "dt",
}

describe("renderBox", () => {
  it("produces a unicode box with headline, body, url, and dismiss hint", () => {
    const out = renderBox(sampleAd, { source: "Carbon" })
    expect(out).toContain("DEV DRIP TV")
    expect(out).toContain("via Carbon")
    expect(out).toContain(sampleAd.headline)
    expect(out).toContain(sampleAd.body)
    expect(out).toContain("vercel.com")
    expect(out).toContain("press enter to dismiss")
    expect(out).toMatch(/╔|╗|╚|╝|║|═/)
  })

  it("uses ASCII fallback when ascii flag is set", () => {
    const out = renderBox(sampleAd, { source: "Carbon", ascii: true })
    expect(out).not.toMatch(/╔|╗|╚|╝|║|═/)
    expect(out).toMatch(/\+|-|\|/)
  })

  it("word-wraps long body text", () => {
    const longBody =
      "This is a much longer advertising body intended to exceed the default line width of 72 columns minus padding so that the renderer has to wrap onto multiple lines cleanly."
    const out = renderBox({ ...sampleAd, body: longBody }, { source: "Carbon" })
    const lines = out.split("\n").filter((l) => l.includes("║") || l.startsWith("|"))
    const longest = Math.max(...lines.map((l) => [...l].length))
    expect(longest).toBeLessThanOrEqual(72)
  })

  it("handles missing body gracefully", () => {
    const out = renderBox({ ...sampleAd, body: undefined }, { source: "Carbon" })
    expect(out).toContain(sampleAd.headline)
    expect(out).toContain("press enter to dismiss")
  })
})
```

- [ ] **Step 5.2: Run test — expect failures**

Run: `pnpm --filter @devdrip/cli test -- render-box`
Expected: import error (module doesn't exist).

- [ ] **Step 5.3: Implement `render-box.ts`**

```typescript
// packages/cli/src/lib/render-box.ts
import type { AdPayload } from "@devdrip/shared"

const WIDTH = 72
const INNER = WIDTH - 4 // space for "║ " and " ║"

interface Chars {
  tl: string
  tr: string
  bl: string
  br: string
  h: string
  v: string
}

const UNI: Chars = { tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║" }
const ASCII: Chars = { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" }

function shouldUseAscii(): boolean {
  if (process.env["NO_COLOR"]) return true
  if (!process.stdout.isTTY) return true
  return false
}

function wrap(text: string, max: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ""
  for (const w of words) {
    if (cur.length === 0) {
      cur = w
      continue
    }
    if (cur.length + 1 + w.length <= max) {
      cur += ` ${w}`
    } else {
      lines.push(cur)
      cur = w
    }
  }
  if (cur.length > 0) lines.push(cur)
  return lines
}

function padRight(s: string, n: number): string {
  const len = [...s].length
  if (len >= n) return s
  return s + " ".repeat(n - len)
}

function line(c: Chars, inner: string): string {
  return `${c.v} ${padRight(inner, INNER)} ${c.v}`
}

export interface RenderBoxOpts {
  source?: string
  earningsUsdc?: number
  ascii?: boolean
}

export function renderBox(
  ad: Pick<AdPayload, "headline" | "body" | "url">,
  opts: RenderBoxOpts = {}
): string {
  const c = (opts.ascii ?? shouldUseAscii()) ? ASCII : UNI
  const sourceBadge = opts.source ? `via ${opts.source}` : ""
  const title = "DEV DRIP TV"

  // header: c.tl + "═ DEV DRIP TV ═...═ via Carbon ═" + c.tr
  const headerInnerLen = WIDTH - 2
  const leftLabel = ` ${title} `
  const rightLabel = sourceBadge ? ` ${sourceBadge} ` : ""
  const fillLen = headerInnerLen - leftLabel.length - rightLabel.length
  const left = c.h + leftLabel
  const right = rightLabel + c.h
  const middle = c.h.repeat(Math.max(0, fillLen - 2))
  const header = `${c.tl}${left}${middle}${right}${c.tr}`

  const body = [
    line(c, ""),
    line(c, ad.headline),
    ...(ad.body ? wrap(ad.body, INNER).map((l) => line(c, l)) : []),
    line(c, ""),
    ...(ad.url ? [line(c, `Learn more → ${ad.url}`)] : []),
    line(c, ""),
    line(c, padRight("", Math.max(0, Math.floor(INNER / 2) - 12)) + "press enter to dismiss"),
  ]

  const footer = `${c.bl}${c.h.repeat(WIDTH - 2)}${c.br}`

  return [header, ...body, footer].join("\n")
}
```

- [ ] **Step 5.4: Run tests — expect 4 passing**

Run: `pnpm --filter @devdrip/cli test -- render-box`
Expected: 4 passing.

- [ ] **Step 5.5: Commit**

```bash
git add packages/cli/src/lib/render-box.ts packages/cli/src/lib/__tests__/render-box.test.ts
git commit -m "S2-07: add renderBox ASCII/unicode ad card"
```

---

## Task 6: CLI — `claude-settings` module (hook merge)

**Files:**

- Create: `packages/cli/src/lib/claude-settings.ts`
- Create: `packages/cli/src/lib/__tests__/claude-settings.test.ts`

Pure functions + FS helpers. `mergeDevdripHooks()` is pure; `readSettings` / `writeSettingsAtomic` / `writeBackupOnce` touch the filesystem.

- [ ] **Step 6.1: Write the failing tests**

```typescript
// packages/cli/src/lib/__tests__/claude-settings.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  mergeDevdripHooks,
  readSettings,
  writeSettingsAtomic,
  writeBackupOnce,
  type Settings,
} from "../claude-settings.js"

const BIN = "/abs/path/to/devdrip"

describe("mergeDevdripHooks", () => {
  it("adds all three events when settings are empty", () => {
    const { next, changed } = mergeDevdripHooks({}, BIN)
    expect(changed).toBe(true)
    expect(next.hooks?.PreToolUse).toHaveLength(1)
    expect(next.hooks?.Stop).toHaveLength(1)
    expect(next.hooks?.UserPromptSubmit).toHaveLength(1)
    expect(next.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command).toBe(`${BIN} hook pre-tool`)
    expect(next.hooks?.PreToolUse?.[0]?.matcher).toBe("*")
  })

  it("preserves other tools' hook entries and appends ours", () => {
    const existing: Settings = {
      hooks: {
        PreToolUse: [{ matcher: "Bash", hooks: [{ type: "command", command: "/other/tool pre" }] }],
      },
    }
    const { next, changed } = mergeDevdripHooks(existing, BIN)
    expect(changed).toBe(true)
    expect(next.hooks?.PreToolUse).toHaveLength(2)
    expect(next.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command).toBe("/other/tool pre")
    expect(next.hooks?.PreToolUse?.[1]?.hooks?.[0]?.command).toBe(`${BIN} hook pre-tool`)
  })

  it("is a no-op when our entries already exist with current bin path", () => {
    const existing: Settings = {
      hooks: {
        PreToolUse: [
          { matcher: "*", hooks: [{ type: "command", command: `${BIN} hook pre-tool` }] },
        ],
        Stop: [{ hooks: [{ type: "command", command: `${BIN} hook stop` }] }],
        UserPromptSubmit: [{ hooks: [{ type: "command", command: `${BIN} hook prompt-submit` }] }],
      },
    }
    const { next, changed } = mergeDevdripHooks(existing, BIN)
    expect(changed).toBe(false)
    expect(next.hooks?.PreToolUse).toHaveLength(1)
  })

  it("updates in place when bin path changed (nvm switch / version bump)", () => {
    const stale = "/old/path/devdrip"
    const existing: Settings = {
      hooks: {
        PreToolUse: [
          { matcher: "*", hooks: [{ type: "command", command: `${stale} hook pre-tool` }] },
        ],
        Stop: [{ hooks: [{ type: "command", command: `${stale} hook stop` }] }],
        UserPromptSubmit: [
          { hooks: [{ type: "command", command: `${stale} hook prompt-submit` }] },
        ],
      },
    }
    const { next, changed } = mergeDevdripHooks(existing, BIN)
    expect(changed).toBe(true)
    expect(next.hooks?.PreToolUse?.[0]?.hooks?.[0]?.command).toBe(`${BIN} hook pre-tool`)
    expect(next.hooks?.Stop?.[0]?.hooks?.[0]?.command).toBe(`${BIN} hook stop`)
    expect(next.hooks?.PreToolUse).toHaveLength(1)
  })

  it("throws on hooks shaped as a non-object", () => {
    expect(() =>
      mergeDevdripHooks({ hooks: "nope" as unknown as Settings["hooks"] }, BIN)
    ).toThrow()
  })
})

describe("readSettings / writeSettingsAtomic / writeBackupOnce", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "devdrip-claude-"))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  it("readSettings returns {} for missing file", async () => {
    const out = await readSettings(join(tempDir, "missing.json"))
    expect(out).toEqual({})
  })

  it("readSettings throws for malformed JSON", async () => {
    const p = join(tempDir, "bad.json")
    writeFileSync(p, "{not json")
    await expect(readSettings(p)).rejects.toThrow()
  })

  it("writeSettingsAtomic writes the file", async () => {
    const p = join(tempDir, "out.json")
    await writeSettingsAtomic(p, { hooks: { Stop: [] } })
    expect(JSON.parse(readFileSync(p, "utf8"))).toEqual({ hooks: { Stop: [] } })
  })

  it("writeBackupOnce copies src to backup only on first call", async () => {
    const src = join(tempDir, "settings.json")
    const backup = join(tempDir, "settings.json.devdrip-backup")
    writeFileSync(src, '{"a":1}')
    await writeBackupOnce(src, backup)
    expect(readFileSync(backup, "utf8")).toBe('{"a":1}')

    // modify source, call again — backup must not change
    writeFileSync(src, '{"a":2}')
    await writeBackupOnce(src, backup)
    expect(readFileSync(backup, "utf8")).toBe('{"a":1}')
  })

  it("writeBackupOnce writes {} when source is missing", async () => {
    const src = join(tempDir, "missing.json")
    const backup = join(tempDir, "missing.json.devdrip-backup")
    await writeBackupOnce(src, backup)
    expect(existsSync(backup)).toBe(true)
    expect(readFileSync(backup, "utf8")).toBe("{}\n")
  })
})
```

- [ ] **Step 6.2: Run test — expect failures**

Run: `pnpm --filter @devdrip/cli test -- claude-settings`
Expected: import errors.

- [ ] **Step 6.3: Implement `claude-settings.ts`**

```typescript
// packages/cli/src/lib/claude-settings.ts
import { randomBytes } from "node:crypto"
import { copyFile, readFile, rename, stat, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"

export interface HookCommand {
  type: "command"
  command: string
}

export interface HookGroup {
  matcher?: string
  hooks: HookCommand[]
}

export interface Settings {
  hooks?: {
    PreToolUse?: HookGroup[]
    Stop?: HookGroup[]
    UserPromptSubmit?: HookGroup[]
    [k: string]: HookGroup[] | undefined
  }
  [k: string]: unknown
}

const DEVDRIP_SUB_RE = /\shook\s+(pre-tool|stop|prompt-submit)(\s|$)/

type Event = "PreToolUse" | "Stop" | "UserPromptSubmit"
type Sub = "pre-tool" | "stop" | "prompt-submit"

const EVENTS: Array<{ event: Event; sub: Sub; matcher?: string }> = [
  { event: "PreToolUse", sub: "pre-tool", matcher: "*" },
  { event: "Stop", sub: "stop" },
  { event: "UserPromptSubmit", sub: "prompt-submit" },
]

function isDevdripGroup(group: HookGroup, binPath: string): { match: boolean; stale: boolean } {
  for (const h of group.hooks ?? []) {
    if (typeof h.command !== "string") continue
    if (!DEVDRIP_SUB_RE.test(h.command)) continue
    if (h.command.startsWith(binPath + " ")) return { match: true, stale: false }
    return { match: true, stale: true }
  }
  return { match: false, stale: false }
}

export function mergeDevdripHooks(
  settings: Settings,
  binPath: string
): { next: Settings; changed: boolean } {
  if (
    settings.hooks !== undefined &&
    (typeof settings.hooks !== "object" || Array.isArray(settings.hooks))
  ) {
    throw new Error("settings.hooks must be an object")
  }

  const next: Settings = { ...settings, hooks: { ...(settings.hooks ?? {}) } }
  let changed = false

  for (const { event, sub, matcher } of EVENTS) {
    const groups = [...(next.hooks?.[event] ?? [])]
    const desiredCmd = `${binPath} hook ${sub}`
    const ours: HookGroup = {
      ...(matcher !== undefined ? { matcher } : {}),
      hooks: [{ type: "command", command: desiredCmd }],
    }

    let found = false
    for (let i = 0; i < groups.length; i++) {
      const g = groups[i]!
      const id = isDevdripGroup(g, binPath)
      if (!id.match) continue
      found = true
      if (id.stale) {
        groups[i] = ours
        changed = true
      }
    }
    if (!found) {
      groups.push(ours)
      changed = true
    }
    next.hooks![event] = groups
  }

  return { next, changed }
}

export async function readSettings(path: string): Promise<Settings> {
  try {
    const raw = await readFile(path, "utf8")
    const parsed = JSON.parse(raw) as Settings
    return parsed ?? {}
  } catch (err) {
    if (isNotFound(err)) return {}
    throw err
  }
}

export async function writeSettingsAtomic(path: string, settings: Settings): Promise<void> {
  const tmp = join(dirname(path), `.settings.${randomBytes(6).toString("hex")}.tmp`)
  await writeFile(tmp, JSON.stringify(settings, null, 2) + "\n")
  await rename(tmp, path)
}

export async function writeBackupOnce(srcPath: string, backupPath: string): Promise<void> {
  try {
    await stat(backupPath)
    return // already exists — preserve it
  } catch (err) {
    if (!isNotFound(err)) throw err
  }
  try {
    await copyFile(srcPath, backupPath)
  } catch (err) {
    if (!isNotFound(err)) throw err
    await writeFile(backupPath, "{}\n")
  }
}

function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "ENOENT"
  )
}
```

- [ ] **Step 6.4: Run tests**

Run: `pnpm --filter @devdrip/cli test -- claude-settings`
Expected: all passing.

- [ ] **Step 6.5: Commit**

```bash
git add packages/cli/src/lib/claude-settings.ts packages/cli/src/lib/__tests__/claude-settings.test.ts
git commit -m "S2-07: add claude-settings hook merge + atomic write + backup"
```

---

## Task 7: CLI — `preferences-client` module

**Files:**

- Create: `packages/cli/src/lib/preferences-client.ts`

Thin wrapper around `apiFetch` for the new PUT endpoint. No dedicated test — covered by the integration test in Task 11.

- [ ] **Step 7.1: Create the module**

```typescript
// packages/cli/src/lib/preferences-client.ts
import type { AdCategory } from "@devdrip/shared"
import { apiFetch } from "./api-client.js"

export interface PreferencesResponse {
  preferences: {
    blockedCategories: AdCategory[]
    enabledSurfaces: string[]
    maxPerHour: number
    maxPerDay: number
    quietHoursStart: number | null
    quietHoursEnd: number | null
    tzOffsetMinutes: number
    idleSensitivityMs: number
  }
}

export interface UpdatePreferencesBody {
  blockedCategories?: AdCategory[]
  tzOffsetMinutes?: number
}

export async function putPreferences(
  body: UpdatePreferencesBody
): Promise<PreferencesResponse["preferences"]> {
  const res = await apiFetch<PreferencesResponse>("/me/preferences", {
    method: "PUT",
    body,
  })
  return res.preferences
}
```

- [ ] **Step 7.2: Typecheck**

Run: `pnpm --filter @devdrip/cli typecheck`
Expected: no errors.

- [ ] **Step 7.3: Commit**

```bash
git add packages/cli/src/lib/preferences-client.ts
git commit -m "S2-07: add preferences-client for PUT /me/preferences"
```

---

## Task 8: CLI — `health` module (four probes)

**Files:**

- Create: `packages/cli/src/lib/health.ts`
- Create: `packages/cli/src/lib/__tests__/health.test.ts`

Four parallel probes. `apiFetch` is mocked via `vi.mock` — no real network.

- [ ] **Step 8.1: Write the failing test**

```typescript
// packages/cli/src/lib/__tests__/health.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

const apiFetchMock = vi.fn()
vi.mock("../api-client.js", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  apiFetchPublic: (...args: unknown[]) => apiFetchMock(...args),
  resolveApiUrl: () => "http://localhost:3000",
}))

const readSettingsMock = vi.fn()
vi.mock("../claude-settings.js", () => ({
  readSettings: (...args: unknown[]) => readSettingsMock(...args),
}))

import { runInitHealthCheck } from "../health.js"
import type { DevdripConfig } from "../config.js"

const cfg: DevdripConfig = {
  version: 2,
  apiUrl: "http://localhost:3000",
  auth: { accessToken: "a", refreshToken: "b", accessTokenExpiresAt: "2099-01-01T00:00:00Z" },
  user: { id: "u", githubLogin: "gh", email: "e@x.com", avatarUrl: null },
  device: { id: "dev-1" },
  cli: { binPath: "/abs/devdrip" },
}

beforeEach(() => {
  apiFetchMock.mockReset()
  readSettingsMock.mockReset()
})

describe("runInitHealthCheck", () => {
  it("returns four ok probes when everything is healthy", async () => {
    apiFetchMock.mockResolvedValue({ ok: true })
    readSettingsMock.mockResolvedValue({
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "/abs/devdrip hook pre-tool" }] }],
      },
    })

    const probes = await runInitHealthCheck(cfg, "/fake/settings.json")
    expect(probes).toHaveLength(4)
    expect(probes.every((p) => p.ok)).toBe(true)
    expect(probes.map((p) => p.name)).toEqual([
      "auth valid (GET /me)",
      "device registered",
      "hooks installed in ~/.claude/settings.json",
      "backend reachable (GET /health)",
    ])
  })

  it("marks device probe as failed when cfg.device.id is null", async () => {
    apiFetchMock.mockResolvedValue({ ok: true })
    readSettingsMock.mockResolvedValue({
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "/abs/devdrip hook pre-tool" }] }],
      },
    })

    const probes = await runInitHealthCheck({ ...cfg, device: { id: null } }, "/fake/settings.json")
    const device = probes.find((p) => p.name === "device registered")
    expect(device?.ok).toBe(false)
  })

  it("marks hooks probe as failed when settings has no devdrip entries", async () => {
    apiFetchMock.mockResolvedValue({ ok: true })
    readSettingsMock.mockResolvedValue({ hooks: {} })
    const probes = await runInitHealthCheck(cfg, "/fake/settings.json")
    const hooks = probes.find((p) => p.name.startsWith("hooks installed"))
    expect(hooks?.ok).toBe(false)
  })

  it("marks auth probe as failed when GET /me throws", async () => {
    apiFetchMock.mockImplementation(async (path: string) => {
      if (path === "/me") throw new Error("unauthorized")
      return { ok: true }
    })
    readSettingsMock.mockResolvedValue({
      hooks: {
        PreToolUse: [{ hooks: [{ type: "command", command: "/abs/devdrip hook pre-tool" }] }],
      },
    })
    const probes = await runInitHealthCheck(cfg, "/fake/settings.json")
    const auth = probes.find((p) => p.name.startsWith("auth valid"))
    expect(auth?.ok).toBe(false)
  })
})
```

- [ ] **Step 8.2: Run test — expect failures**

Run: `pnpm --filter @devdrip/cli test -- health`
Expected: import errors.

- [ ] **Step 8.3: Implement `health.ts`**

```typescript
// packages/cli/src/lib/health.ts
import { apiFetch, apiFetchPublic, resolveApiUrl } from "./api-client.js"
import { readSettings } from "./claude-settings.js"
import type { DevdripConfig } from "./config.js"

export interface Probe {
  name: string
  ok: boolean
  detail: string
}

const PROBE_TIMEOUT_MS = 500

async function probeAuth(): Promise<Probe> {
  try {
    await apiFetch<unknown>("/me", { timeoutMs: PROBE_TIMEOUT_MS })
    return { name: "auth valid (GET /me)", ok: true, detail: "" }
  } catch (err) {
    return { name: "auth valid (GET /me)", ok: false, detail: errDetail(err) }
  }
}

async function probeDevice(cfg: DevdripConfig): Promise<Probe> {
  const id = cfg.device?.id
  if (!id) {
    return { name: "device registered", ok: false, detail: "no device.id in config" }
  }
  return { name: "device registered", ok: true, detail: `id: ${id.slice(0, 8)}…` }
}

async function probeHooks(settingsPath: string, binPath: string): Promise<Probe> {
  try {
    const s = await readSettings(settingsPath)
    const hasOurs = (Object.values(s.hooks ?? {}) as unknown[]).some(
      (groups) =>
        Array.isArray(groups) &&
        groups.some(
          (g) =>
            g &&
            typeof g === "object" &&
            Array.isArray((g as { hooks?: unknown[] }).hooks) &&
            (g as { hooks: Array<{ command?: string }> }).hooks.some(
              (h) => typeof h.command === "string" && h.command.startsWith(binPath + " hook ")
            )
        )
    )
    return {
      name: "hooks installed in ~/.claude/settings.json",
      ok: hasOurs,
      detail: hasOurs ? "" : "no devdrip hook entries found",
    }
  } catch (err) {
    return {
      name: "hooks installed in ~/.claude/settings.json",
      ok: false,
      detail: errDetail(err),
    }
  }
}

async function probeBackend(): Promise<Probe> {
  try {
    await apiFetchPublic<unknown>("/health", { timeoutMs: PROBE_TIMEOUT_MS })
    return { name: "backend reachable (GET /health)", ok: true, detail: "" }
  } catch (err) {
    return { name: "backend reachable (GET /health)", ok: false, detail: errDetail(err) }
  }
}

export async function runInitHealthCheck(
  cfg: DevdripConfig,
  settingsPath: string
): Promise<Probe[]> {
  const binPath = cfg.cli?.binPath ?? ""
  const [auth, device, hooks, backend] = await Promise.all([
    probeAuth(),
    probeDevice(cfg),
    probeHooks(settingsPath, binPath),
    probeBackend(),
  ])
  return [auth, device, hooks, backend]
}

function errDetail(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

// resolveApiUrl is imported only so the mock surface in tests matches reality
export { resolveApiUrl }
```

- [ ] **Step 8.4: Run tests**

Run: `pnpm --filter @devdrip/cli test -- health`
Expected: 4 passing.

- [ ] **Step 8.5: Commit**

```bash
git add packages/cli/src/lib/health.ts packages/cli/src/lib/__tests__/health.test.ts
git commit -m "S2-07: add four-probe init health check"
```

---

## Task 9: CLI — rewrite `demo` command

**Files:**

- Modify: `packages/cli/src/commands/demo.ts`

Exports both the Commander command and a reusable `runDemo()` function so `init` can call it in-process.

- [ ] **Step 9.1: Replace `demo.ts`**

```typescript
// packages/cli/src/commands/demo.ts
import { createInterface } from "node:readline/promises"
import { Command } from "commander"
import { apiFetch, ApiError, NotAuthenticatedError, reportError } from "../lib/api-client.js"
import { readConfig } from "../lib/config.js"
import { renderBox } from "../lib/render-box.js"

interface AdNextResponse {
  ad: {
    id: string
    campaign_id: string
    format: "text" | "banner" | "sponsored-link"
    headline: string
    body?: string
    url: string
    display_time_ms: number
    delivery_token: string
  }
}

export async function runDemo(): Promise<void> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError("not signed in — run `devdrip auth` or `devdrip init`")

  const deviceId = cfg.device?.id
  if (!deviceId) {
    throw new Error("device not registered — run `devdrip init`")
  }

  let body: AdNextResponse | null = null
  try {
    body = await apiFetch<AdNextResponse>(`/ads/next`, {
      query: { surface: "terminal-tv", deviceId },
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 204) {
      body = null
    } else {
      throw err
    }
  }

  if (!body || !body.ad) {
    console.log("no ads queued right now — try `devdrip demo` after your next Claude session")
    return
  }

  const ad = body.ad
  console.log(
    renderBox({ headline: ad.headline, body: ad.body, url: ad.url }, { source: "Carbon" })
  )

  if (process.stdin.isTTY) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    try {
      await rl.question("")
    } finally {
      rl.close()
    }
  }
}

export const demoCmd = new Command("demo")
  .description("fire a demo ad immediately")
  .action(async () => {
    try {
      await runDemo()
    } catch (err) {
      reportError(err)
    }
  })
```

- [ ] **Step 9.2: Typecheck**

Run: `pnpm --filter @devdrip/cli typecheck`
Expected: no errors. `reportError` is already exported by `api-client.ts` (verified — line 169).

- [ ] **Step 9.3: Commit**

```bash
git add packages/cli/src/commands/demo.ts
git commit -m "S2-07: implement devdrip demo (one-shot fetch + render)"
```

---

## Task 10: CLI — build `init` command (wizard orchestrator)

**Files:**

- Modify: `packages/cli/src/commands/init.ts`

Full wizard wiring auth + registerDevice + category prompt + PUT preferences + hook merge + demo + health check + summary.

- [ ] **Step 10.1: Replace `init.ts`**

```typescript
// packages/cli/src/commands/init.ts
import { stat } from "node:fs/promises"
import { homedir, hostname, platform } from "node:os"
import { realpathSync } from "node:fs"
import { join } from "node:path"
import { Command } from "commander"
import { multiselect, intro, outro, cancel, isCancel } from "@clack/prompts"
import { AdCategory, REVENUE_SHARE_DEVELOPER } from "@devdrip/shared"
import { apiFetch, NotAuthenticatedError, reportError } from "../lib/api-client.js"
import { readConfig, writeConfig } from "../lib/config.js"
import {
  readSettings,
  writeSettingsAtomic,
  writeBackupOnce,
  mergeDevdripHooks,
} from "../lib/claude-settings.js"
import { putPreferences } from "../lib/preferences-client.js"
import { runInitHealthCheck } from "../lib/health.js"
import { runDemo } from "./demo.js"
import { registerDevice } from "../lib/device.js"

const CATEGORY_LABELS: Record<AdCategory, string> = {
  [AdCategory.CloudInfrastructure]: "Cloud & infrastructure",
  [AdCategory.DeveloperTools]: "Developer tools",
  [AdCategory.Databases]: "Databases",
  [AdCategory.MonitoringObservability]: "Monitoring & observability",
  [AdCategory.DeveloperRecruiting]: "Developer recruiting / jobs",
  [AdCategory.DeveloperEducation]: "Developer education",
  [AdCategory.SaasProducts]: "SaaS products",
}

const ALL_CATEGORIES = Object.values(AdCategory) as AdCategory[]
const DEFAULT_CPM = 0.8

function claudeDir(): string {
  return join(homedir(), ".claude")
}

function claudeSettingsPath(): string {
  return join(claudeDir(), "settings.json")
}

function claudeBackupPath(): string {
  return `${claudeSettingsPath()}.devdrip-backup`
}

function resolveBinPath(): string {
  const arg = process.argv[1]
  if (!arg) return ""
  try {
    return realpathSync(arg)
  } catch {
    return arg
  }
}

async function ensureAuth(): Promise<void> {
  const cfg = await readConfig()
  if (cfg) {
    console.log(`✓ signed in as @${cfg.user.githubLogin || cfg.user.email}`)
    return
  }
  console.log("no local session — starting GitHub sign-in…")
  // reuse the existing auth command's runLogin flow
  const { runLogin } = await import("./auth.js").then((m) =>
    Promise.resolve(m as unknown as { runLogin?: (force: boolean) => Promise<void> })
  )
  if (!runLogin) {
    throw new Error("auth flow unavailable — run `devdrip auth` then `devdrip init` again")
  }
  await runLogin(false)
  const after = await readConfig()
  if (!after) throw new NotAuthenticatedError("sign-in did not complete")
}

async function ensureClaudeDir(): Promise<void> {
  try {
    await stat(claudeDir())
    console.log(`✓ Claude Code detected (${claudeDir()})`)
  } catch {
    console.error(
      `Claude Code not found at ${claudeDir()}. Install it first: https://claude.ai/download`
    )
    process.exit(1)
  }
}

async function ensureDevice(): Promise<{ deviceId: string }> {
  const cfg = await readConfig()
  if (!cfg) throw new NotAuthenticatedError()

  if (cfg.device?.id) {
    console.log(`✓ device: ${hostname()} (${platform()})`)
    return { deviceId: cfg.device.id }
  }

  const device = await registerDevice(cfg.auth.accessToken, cfg.apiUrl)
  const updated = { ...cfg, device: { id: device.id } }
  await writeConfig(updated)
  console.log(`✓ device: ${hostname()} (${platform()}/${device.ideType})`)
  return { deviceId: device.id }
}

async function pickCategories(current: AdCategory[]): Promise<AdCategory[]> {
  const preCheckedAllowed = ALL_CATEGORIES.filter((c) => !current.includes(c))

  const selected = await multiselect<AdCategory>({
    message: "Which categories would you like to see ads from?",
    options: ALL_CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABELS[c] })),
    initialValues: preCheckedAllowed,
    required: false,
  })

  if (isCancel(selected)) {
    cancel("cancelled")
    process.exit(0)
  }

  const allowed = selected as AdCategory[]
  return ALL_CATEGORIES.filter((c) => !allowed.includes(c))
}

async function savePreferences(blocked: AdCategory[]): Promise<void> {
  const tzOffsetMinutes = -new Date().getTimezoneOffset()
  await putPreferences({ blockedCategories: blocked, tzOffsetMinutes })
  console.log(
    blocked.length === 0
      ? "✓ preferences saved (all categories allowed)"
      : `✓ preferences saved (${blocked.length} categor${blocked.length === 1 ? "y" : "ies"} blocked)`
  )
}

async function installHooks(): Promise<void> {
  const settingsPath = claudeSettingsPath()
  const backupPath = claudeBackupPath()
  const binPath = resolveBinPath()

  await writeBackupOnce(settingsPath, backupPath)

  const existing = await readSettings(settingsPath)
  const { next, changed } = mergeDevdripHooks(existing, binPath)
  if (!changed) {
    console.log(`✓ hooks already installed`)
    return
  }
  await writeSettingsAtomic(settingsPath, next)

  const cfg = await readConfig()
  if (cfg && cfg.cli?.binPath !== binPath) {
    await writeConfig({ ...cfg, cli: { binPath } })
  }
  console.log(`✓ hooks installed in ${settingsPath}`)
}

async function previewAd(): Promise<void> {
  console.log("\nhere's a preview ad from the real pipeline:\n")
  await runDemo()
  console.log()
}

async function runHealthCheck(): Promise<boolean> {
  const cfg = await readConfig()
  if (!cfg) return false
  const probes = await runInitHealthCheck(cfg, claudeSettingsPath())
  console.log("\nhealth check:")
  for (const p of probes) {
    const mark = p.ok ? "✓" : "✗"
    const detail = p.detail ? ` (${p.detail})` : ""
    console.log(`  ${mark} ${p.name}${detail}`)
  }
  return probes.every((p) => p.ok)
}

function printSummary(): void {
  const hoursPerDay = 4
  const adsPerHourLight = 2
  const adsPerHourModerate = 4
  const cpm = DEFAULT_CPM
  const share = REVENUE_SHARE_DEVELOPER

  const low = hoursPerDay * adsPerHourLight * 30 * (cpm / 1000) * share
  const high = hoursPerDay * adsPerHourModerate * 30 * (cpm / 1000) * share
  const perAd = (cpm / 1000) * share

  console.log("")
  console.log("✓ all set.")
  console.log("")
  console.log(`early-mvp earnings estimate: ~$${low.toFixed(2)}–$${high.toFixed(2)}/month`)
  console.log(
    `  assumes ${hoursPerDay}h Claude usage/day · ${adsPerHourLight}–${adsPerHourModerate} ads/hr · $${cpm.toFixed(2)} CPM · ${Math.round(share * 100)}% dev share`
  )
  console.log(`  that's ~$${perAd.toFixed(5)} per ad — rates climb as premium campaigns join.`)
  console.log(`  → dashboard: https://devdrip.xyz (coming soon)`)
  console.log(`  → run \`devdrip status\` to see actual earnings`)
  console.log("")
  console.log("open a new Claude Code session to start earning.")
}

export async function runInit(): Promise<void> {
  intro("devdrip init — let's get you earning")

  await ensureAuth()
  await ensureClaudeDir()
  await ensureDevice()

  // GET /preferences doesn't exist yet (S4-06) — MVP init starts with no blocks pre-checked
  const blocked = await pickCategories([])
  await savePreferences(blocked)

  await installHooks()
  await previewAd()

  const ok = await runHealthCheck()
  printSummary()

  if (!ok) {
    outro("one or more health checks failed — see ✗ above")
    process.exit(1)
  }
  outro("")
}

export const initCmd = new Command("init")
  .description("guided onboarding wizard")
  .action(async () => {
    try {
      await runInit()
    } catch (err) {
      reportError(err)
    }
  })
```

- [ ] **Step 10.2: Export `runLogin` from `auth.ts`**

The init command imports `runLogin` but `auth.ts` currently keeps it private. Open `packages/cli/src/commands/auth.ts` and change:

```typescript
async function runLogin(force: boolean): Promise<void> {
```

to:

```typescript
export async function runLogin(force: boolean): Promise<void> {
```

- [ ] **Step 10.3: Typecheck**

Run: `pnpm --filter @devdrip/cli typecheck`
Expected: no errors. If `reportError` is not exported from `api-client.ts`, add it there too:

```typescript
export function reportError(err: unknown): never {
  if (err instanceof Error) {
    console.error(err.message)
  } else {
    console.error(String(err))
  }
  process.exit(1)
}
```

(It's already imported by `auth.ts`, so it should exist — if not, add.)

- [ ] **Step 10.4: Commit**

```bash
git add packages/cli/src/commands/init.ts packages/cli/src/commands/auth.ts
git commit -m "S2-07: implement devdrip init onboarding wizard"
```

---

## Task 11: CLI — integration test for `init`

**Files:**

- Create: `packages/cli/src/commands/__tests__/init.test.ts`

Tests the wizard end-to-end against a temp `$HOME` and a mocked API. `@clack/prompts.multiselect` is mocked so there's no interactive stdin.

- [ ] **Step 11.1: Write the test**

```typescript
// packages/cli/src/commands/__tests__/init.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AdCategory } from "@devdrip/shared"

let tempHome: string

const apiFetchMock = vi.fn()
vi.mock("../../lib/api-client.js", async () => {
  return {
    apiFetch: (...args: unknown[]) => apiFetchMock(...args),
    apiFetchPublic: (...args: unknown[]) => apiFetchMock(...args),
    resolveApiUrl: () => "http://localhost:3000",
    ApiError: class ApiError extends Error {
      constructor(
        public status: number,
        public code: string
      ) {
        super(code)
      }
    },
    NotAuthenticatedError: class NotAuthenticatedError extends Error {},
    reportError: (err: unknown) => {
      throw err
    },
  }
})

vi.mock("../../lib/device.js", async () => ({
  registerDevice: vi.fn().mockResolvedValue({
    id: "00000000-1111-2222-3333-444444444444",
    userId: "u1",
    deviceName: "host",
    os: "darwin",
    ideType: "terminal",
    lastHeartbeat: null,
    createdAt: "2026-04-21T00:00:00Z",
  }),
}))

const multiselectMock = vi.fn()
vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  note: vi.fn(),
  cancel: vi.fn(),
  isCancel: () => false,
  multiselect: (...args: unknown[]) => multiselectMock(...args),
}))

// runLogin is only reached when no config exists — for these tests we pre-seed a config
vi.mock("../auth.js", () => ({
  runLogin: vi.fn().mockImplementation(async () => {
    throw new Error("runLogin should not be called when config already exists")
  }),
}))

vi.mock("../demo.js", () => ({
  runDemo: vi.fn().mockResolvedValue(undefined),
  demoCmd: {},
}))

beforeEach(() => {
  tempHome = mkdtempSync(join(tmpdir(), "devdrip-init-"))
  process.env["HOME"] = tempHome
  // seed a v2 config so auth step is a no-op
  mkdirSync(join(tempHome, ".devdrip"), { recursive: true, mode: 0o700 })
  writeFileSync(
    join(tempHome, ".devdrip", "config.json"),
    JSON.stringify({
      version: 2,
      apiUrl: "http://localhost:3000",
      auth: { accessToken: "a", refreshToken: "b", accessTokenExpiresAt: "2099-01-01T00:00:00Z" },
      user: { id: "u1", githubLogin: "gh", email: "e@x.com", avatarUrl: null },
      device: { id: null },
      cli: { binPath: "" },
    }),
    { mode: 0o600 }
  )
  // create ~/.claude so the Claude Code check passes
  mkdirSync(join(tempHome, ".claude"), { recursive: true })

  apiFetchMock.mockReset().mockImplementation(async (path: string) => {
    if (path === "/me") return { id: "u1", githubLogin: "gh", email: "e@x.com", avatarUrl: null }
    if (path === "/health") return { ok: true }
    if (path === "/me/preferences") return { preferences: {} }
    return {}
  })
  multiselectMock.mockReset().mockResolvedValue([
    AdCategory.CloudInfrastructure,
    AdCategory.DeveloperTools,
    AdCategory.Databases,
    AdCategory.MonitoringObservability,
    AdCategory.DeveloperEducation,
    AdCategory.SaasProducts,
    // user un-checked DeveloperRecruiting
  ])
})

afterEach(() => {
  rmSync(tempHome, { recursive: true, force: true })
})

describe("devdrip init", () => {
  it("writes hooks, backup, updates config with device.id + binPath, PUTs preferences", async () => {
    // force-exit hijack: printSummary calls outro which calls nothing destructive
    const { runInit } = await import("../init.js")
    await runInit()

    // settings.json contains all three events with our bin path
    const settings = JSON.parse(
      readFileSync(join(tempHome, ".claude", "settings.json"), "utf8")
    ) as { hooks: { [k: string]: Array<{ hooks: Array<{ command: string }> }> } }
    expect(settings.hooks.PreToolUse?.[0]?.hooks[0]?.command).toMatch(/hook pre-tool$/)
    expect(settings.hooks.Stop?.[0]?.hooks[0]?.command).toMatch(/hook stop$/)
    expect(settings.hooks.UserPromptSubmit?.[0]?.hooks[0]?.command).toMatch(/hook prompt-submit$/)

    // backup written
    expect(existsSync(join(tempHome, ".claude", "settings.json.devdrip-backup"))).toBe(true)

    // config updated with device.id and a non-empty binPath
    const cfgRaw = readFileSync(join(tempHome, ".devdrip", "config.json"), "utf8")
    const cfg = JSON.parse(cfgRaw) as {
      device: { id: string | null }
      cli: { binPath: string }
    }
    expect(cfg.device.id).toBe("00000000-1111-2222-3333-444444444444")
    expect(cfg.cli.binPath.length).toBeGreaterThan(0)

    // preferences PUT body
    const putCall = apiFetchMock.mock.calls.find(
      ([path, init]) => path === "/me/preferences" && (init as { method?: string }).method === "PUT"
    )
    expect(putCall).toBeDefined()
    const putBody = (putCall?.[1] as { body: { blockedCategories: string[] } }).body
    expect(putBody.blockedCategories).toEqual([AdCategory.DeveloperRecruiting])
  })

  it("is idempotent on second run — no duplicate hook groups", async () => {
    const { runInit } = await import("../init.js")
    await runInit()
    await runInit()

    const settings = JSON.parse(
      readFileSync(join(tempHome, ".claude", "settings.json"), "utf8")
    ) as { hooks: { [k: string]: unknown[] } }
    expect(settings.hooks.PreToolUse).toHaveLength(1)
    expect(settings.hooks.Stop).toHaveLength(1)
    expect(settings.hooks.UserPromptSubmit).toHaveLength(1)
  })

  it("preserves a pre-existing backup untouched on re-run", async () => {
    const settingsPath = join(tempHome, ".claude", "settings.json")
    const backupPath = `${settingsPath}.devdrip-backup`
    writeFileSync(
      settingsPath,
      '{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"/other/tool foo"}]}]}}'
    )

    const { runInit } = await import("../init.js")
    await runInit()

    expect(readFileSync(backupPath, "utf8")).toContain("/other/tool foo")

    // second run must not overwrite backup even if settings changes
    writeFileSync(settingsPath, '{"hooks":{}}')
    await runInit()
    expect(readFileSync(backupPath, "utf8")).toContain("/other/tool foo")
  })
})
```

- [ ] **Step 11.2: Run the test**

Run: `pnpm --filter @devdrip/cli test -- init`
Expected: 3 passing.

- [ ] **Step 11.3: Commit**

```bash
git add packages/cli/src/commands/__tests__/init.test.ts
git commit -m "S2-07: integration test for devdrip init"
```

---

## Task 12: Wire new deps; final typecheck + test; build

**Files:**

- No new files — sanity pass.

- [ ] **Step 12.1: Full typecheck**

Run: `pnpm turbo run typecheck`
Expected: all packages pass.

- [ ] **Step 12.2: Full test run**

Run: `pnpm turbo run test`
Expected: all tests pass including the new ones.

- [ ] **Step 12.3: Build the CLI**

Run: `pnpm --filter @devdrip/cli build`
Expected: `packages/cli/dist/index.js` builds without errors.

- [ ] **Step 12.4: Commit if anything drifted**

```bash
git status
# if modified files remain, commit them:
# git add -A && git commit -m "S2-07: fixup after integration"
```

---

## Task 13: Update gitbook docs

**Files:**

- Modify: `gitbook-docs/cli/current-state.md`
- Modify: `gitbook-docs/backend/api.md`

- [ ] **Step 13.1: Update `gitbook-docs/cli/current-state.md`**

Find the section listing `init` as a placeholder. Add a new subsection after the `auth` section titled `## devdrip init (S2-07)` with the following content (quad-backtick fences let inner code blocks render — in the actual doc, use triple backticks):

```markdown
## devdrip init (S2-07)

`devdrip init` turns a fresh install into a working DevDrip setup. Seven visible steps, two user actions on first run (GitHub sign-in + one category multi-select + enter to dismiss preview ad). All steps detect prior state and skip if already done, so the command is safe to re-run to heal a broken install.

Flow:

1. **auth** — if `~/.devdrip/config.json` is missing, runs the GitHub OAuth flow inline (same as `devdrip auth`).
2. **Claude Code detection** — hard error if `~/.claude/` isn't present; prints the install link.
3. **device registration** — silent `POST /devices`; stores the returned `device.id` in config under `device: { id }`.
4. **category picker** — `@clack/prompts` multi-select over the seven `AdCategory` values; all pre-checked. Un-checked categories become `blockedCategories` server-side.
5. **preferences saved** — `PUT /me/preferences` with `{ blockedCategories, tzOffsetMinutes }`. `maxPerHour` / `maxPerDay` / quiet hours stay at DB defaults until the dashboard sync API (S4-06) ships.
6. **hooks installed** — merges `PreToolUse`, `Stop`, `UserPromptSubmit` entries into `~/.claude/settings.json`. First-install backup preserved at `~/.claude/settings.json.devdrip-backup`. Existing entries from other tools (MCP, etc.) are never modified — devdrip appends its own matcher group to each event array.
7. **ad preview** — invokes `devdrip demo` in-process: one `GET /ads/next` via the real Carbon-primary waterfall, rendered as an ASCII box, dismiss on enter.
8. **health check** — four parallel probes (auth, device, hooks, backend) printed as ✓/✗ lines. Exits non-zero if any fail.
9. **summary** — earnings projection with an honest per-ad rate, dashboard pointer, and `devdrip status` hint.

Config schema bumped to v2 with new `device: { id }` and `cli: { binPath }` fields. v1 configs migrate on read.

## devdrip demo (S2-07, partial — S5-04 owns the polished version)

`devdrip demo` fetches one real ad from `GET /ads/next?surface=terminal-tv&deviceId=<id>` and renders it via `renderBox()` (fixed 72-col unicode box, ASCII fallback when not a TTY or `NO_COLOR=1`). Press enter to dismiss. If the backend returns 204 (no ads queued), it prints a graceful "try again after your next Claude session" message. The `[DEMO]` badge, interactive key practice, and vanish-timing stats remain scoped to S5-04.
```

- [ ] **Step 13.2: Update `gitbook-docs/backend/api.md`**

Near the `/me` section, add the following (triple-backticks in the actual doc):

````markdown
### PUT /me/preferences

Upsert the current user's preferences row. Only keys present in the body are written; unspecified columns preserve prior values.

**Request body** (all keys optional):

```json
{
  "blockedCategories": ["developer-recruiting"],
  "tzOffsetMinutes": -330
}
```

**Validation:**

- `blockedCategories` — array; each element must be a valid `AdCategory` enum value.
- `tzOffsetMinutes` — integer in `[-720, 840]`.
- Unknown top-level keys → 400 `{ error: "unknown_field" }`.

**Response (200):**

```json
{
  "preferences": {
    "blockedCategories": ["developer-recruiting"],
    "enabledSurfaces": ["terminal-tv", ...],
    "maxPerHour": 8,
    "maxPerDay": 60,
    "quietHoursStart": null,
    "quietHoursEnd": null,
    "tzOffsetMinutes": -330,
    "idleSensitivityMs": 10000
  }
}
```

**Scope note (S4-06).** This endpoint is the `PUT` half only. `GET /preferences`, the daemon's 30-min sync loop, and the dashboard preferences UI remain in S4-06.
````

- [ ] **Step 13.3: Commit**

```bash
git add gitbook-docs/cli/current-state.md gitbook-docs/backend/api.md
git commit -m "S2-07: docs for devdrip init + PUT /me/preferences"
```

---

## Task 14: Manual local demo run (verification before PR)

No code changes. Walk through the user-facing flow to confirm it feels right, catch anything that only shows up with real IO.

- [ ] **Step 14.1: Spin up local postgres + migrate + seed**

```bash
bash ~/.superset/worktrees/devdrip/setup-worktree.sh --db-up
pnpm --filter @devdrip/api db:migrate
pnpm --filter @devdrip/api db:seed
```

Expected: Postgres healthy, tables migrated, one seeded manual campaign present.

- [ ] **Step 14.2: Start API in dev**

In a second terminal:

```bash
pnpm --filter @devdrip/api dev
```

Expected: listens on `:3000`, no errors in log.

- [ ] **Step 14.3: Reset any prior devdrip state**

```bash
rm -rf ~/.devdrip
[ -f ~/.claude/settings.json.devdrip-backup ] && mv ~/.claude/settings.json.devdrip-backup ~/.claude/settings.json || true
```

- [ ] **Step 14.4: Build the CLI and run init against local API**

```bash
pnpm --filter @devdrip/cli build
DEVDRIP_API_URL=http://localhost:3000 node packages/cli/dist/index.js init
```

Expected flow:

1. Browser opens to GitHub OAuth; sign in.
2. `✓ Claude Code detected`.
3. `✓ device: <hostname>`.
4. Category multi-select appears — hit enter to accept all.
5. `✓ preferences saved`.
6. `✓ hooks installed in ~/.claude/settings.json`.
7. Ad box renders (from seeded manual campaign).
8. Press enter to dismiss.
9. Four ✓ health-check lines.
10. Earnings summary.

- [ ] **Step 14.5: Verify state via curl + file inspection**

```bash
cat ~/.devdrip/config.json | jq '{ handle: .user.githubLogin, device: .device.id, bin: .cli.binPath }'
cat ~/.claude/settings.json | jq '.hooks'
cat ~/.claude/settings.json.devdrip-backup | jq '.'
TOKEN=$(jq -r .auth.accessToken < ~/.devdrip/config.json)
DEVICE=$(jq -r .device.id < ~/.devdrip/config.json)
curl -s http://localhost:3000/me -H "Authorization: Bearer $TOKEN" | jq
curl -s "http://localhost:3000/ads/next?surface=terminal-tv&deviceId=$DEVICE" \
     -H "Authorization: Bearer $TOKEN" | jq
```

Expected: config contains device id + absolute binPath; settings.json hooks for all three events; backup exists; `/me` returns your profile; `/ads/next` returns a served ad JSON.

- [ ] **Step 14.6: Verify idempotency (run init again)**

```bash
DEVDRIP_API_URL=http://localhost:3000 node packages/cli/dist/index.js init
```

Expected: runs in ~2s; six ✓ lines (auth, Claude dir, device, preferences re-saved, hooks already installed, ad preview); no duplicate entries in `settings.json`.

- [ ] **Step 14.7: Verify demo alone works**

```bash
DEVDRIP_API_URL=http://localhost:3000 node packages/cli/dist/index.js demo
```

Expected: ad box renders, press enter to dismiss.

- [ ] **Step 14.8: Dry-run the hook commands (handlers are still placeholders from S2-11)**

```bash
$(jq -r .cli.binPath < ~/.devdrip/config.json) hook pre-tool < /dev/null ; echo "exit=$?"
$(jq -r .cli.binPath < ~/.devdrip/config.json) hook stop < /dev/null ; echo "exit=$?"
$(jq -r .cli.binPath < ~/.devdrip/config.json) hook prompt-submit < /dev/null ; echo "exit=$?"
```

Expected: `exit=0` for all three (they print `TODO: …` from the existing placeholder handlers; real handlers come in S2-11).

---

## Task 15: Post-merge Notion + memory updates (not in code)

Not a coding task — actions to take after the PR merges. List here so nothing falls through.

- [ ] **Step 15.1: Tick S2-07 AC checkboxes + post completion comment** on the Notion ticket `devdrip init — onboarding wizard`. Include:
  - What shipped (wizard, `PUT /me/preferences`, `renderBox`, `devdrip demo`, inline health check).
  - What was descoped from the original ticket (daemon start, monthly earnings formula overhaul, frequency preset prompt).
  - What was pulled forward from other tickets and what's left on each.

- [ ] **Step 15.2: Post scope-update comments:**
  - **S4-06 Preferences sync API** — `PUT /preferences` shipped in S2-07. Remaining: `GET /preferences`, 30-min daemon sync loop, last-write-wins conflict resolution, dashboard preferences UI.
  - **S3-01 ANSI box renderer** — minimal `renderBox()` shipped in S2-07 (fixed 72 cols, no action keys, no progress bar). Remaining: 50/60/80/100 col adaptation, `[D][S][K][M]` footer, progress bar, polished source/advertiser badges.
  - **S5-04 devdrip demo command** — minimal one-shot shipped in S2-07. Remaining: `[DEMO]` badge, interactive key practice, vanish-timing stats.
  - **S5-02 devdrip doctor command** — inline four-probe health check shipped in `init`. Remaining: full standalone `doctor` with colored pass/fail, per-failure remediation, daemon/cache/tty/disk probes.
  - **S2-11 Hook commands** — init now writes hook entries pointing at `devdrip hook pre-tool|stop|prompt-submit`. S2-11 still owns implementing the real handlers.

- [ ] **Step 15.3:** Move S2-07 to Done in Notion.

---

## Done definition

- All tests in Tasks 3, 4, 5, 6, 8, 11 pass.
- Full repo typecheck + build pass (Task 12).
- Local manual flow (Task 14) renders a real ad and produces the expected files.
- Gitbook docs updated (Task 13).
- Notion updates posted (Task 15).
