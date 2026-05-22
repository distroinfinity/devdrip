// single source of truth for cross-environment URLs.
// every package (api, cli, frontend) resolves through resolveEnv() so a wrong
// hardcoded URL in one place can't drift away from the rest.

export type DistroEnv = "local" | "staging" | "prod"

export interface EnvBundle {
  env: DistroEnv
  apiUrl: string
  webUrl: string
}

const BUNDLES: Record<DistroEnv, Omit<EnvBundle, "env">> = {
  local: {
    apiUrl: "http://localhost:3011",
    webUrl: "http://localhost:3010",
  },
  staging: {
    apiUrl: "https://devdrip-api-staging.up.railway.app",
    webUrl: "https://staging.devdrip.xyz",
  },
  prod: {
    apiUrl: "https://devdrip-api-production.up.railway.app",
    webUrl: "https://devdrip.xyz",
  },
}

export interface ResolveEnvOptions {
  distroEnv?: string | undefined
  apiUrl?: string | undefined
  webUrl?: string | undefined
  nodeEnv?: string | undefined
}

export function resolveEnv(opts: ResolveEnvOptions = {}): EnvBundle {
  const env = pickEnv(opts.distroEnv, opts.nodeEnv)
  const base = BUNDLES[env]
  return {
    env,
    apiUrl: stripTrailingSlash(opts.apiUrl ?? base.apiUrl),
    webUrl: stripTrailingSlash(opts.webUrl ?? base.webUrl),
  }
}

export function isDistroEnv(v: string | undefined): v is DistroEnv {
  return v === "local" || v === "staging" || v === "prod"
}

function pickEnv(distroEnv: string | undefined, nodeEnv: string | undefined): DistroEnv {
  const e = (distroEnv ?? "").toLowerCase()
  if (isDistroEnv(e)) return e
  return nodeEnv === "production" ? "prod" : "local"
}

function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, "")
}
