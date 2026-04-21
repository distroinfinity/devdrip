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
