import { Redis } from "@upstash/redis"
import { env } from "../config/env.js"

let _redis: Redis | undefined

type StoredValue = {
  value: string
  expiresAt?: number
}

class TestRedis {
  private store = new Map<string, StoredValue>()

  private isExpired(entry: StoredValue | undefined): boolean {
    return !!entry?.expiresAt && entry.expiresAt <= Date.now()
  }

  private read(key: string): StoredValue | undefined {
    const entry = this.store.get(key)
    if (this.isExpired(entry)) {
      this.store.delete(key)
      return undefined
    }
    return entry
  }

  async ping(): Promise<string> {
    return "PONG"
  }

  async set(key: string, value: string, opts?: { ex?: number }): Promise<"OK"> {
    const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : undefined
    this.store.set(key, { value, expiresAt })
    return "OK"
  }

  async get<T = string>(key: string): Promise<T | null> {
    const entry = this.read(key)
    return entry ? (entry.value as T) : null
  }

  async getdel<T = string>(key: string): Promise<T | null> {
    const entry = this.read(key)
    this.store.delete(key)
    return entry ? (entry.value as T) : null
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0
    for (const key of keys) {
      if (this.store.delete(key)) deleted += 1
    }
    return deleted
  }

  async incr(key: string): Promise<number> {
    const current = Number((await this.get(key)) ?? "0")
    const next = current + 1
    const expiresAt = this.read(key)?.expiresAt
    this.store.set(key, { value: String(next), expiresAt })
    return next
  }

  async incrbyfloat(key: string, delta: number): Promise<number> {
    const current = Number((await this.get(key)) ?? "0")
    const next = current + delta
    const expiresAt = this.read(key)?.expiresAt
    this.store.set(key, { value: String(next), expiresAt })
    return next
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.read(key)
    if (!entry) return 0
    this.store.set(key, { ...entry, expiresAt: Date.now() + seconds * 1000 })
    return 1
  }

  pipeline() {
    const ops: Array<() => Promise<unknown>> = []
    const pipeline = {
      incr: (key: string) => {
        ops.push(() => this.incr(key))
        return pipeline
      },
      incrbyfloat: (key: string, delta: number) => {
        ops.push(() => this.incrbyfloat(key, delta))
        return pipeline
      },
      expire: (key: string, seconds: number) => {
        ops.push(() => this.expire(key, seconds))
        return pipeline
      },
      exec: async () => {
        const results: unknown[] = []
        for (const op of ops) results.push(await op())
        return results
      },
    }
    return pipeline
  }
}

let _memoryRedis: Redis | undefined

export function getRedis(): Redis {
  // use in-memory redis for tests and local dev without Upstash
  if (process.env.NODE_ENV === "test" || !process.env["UPSTASH_REDIS_REST_URL"]) {
    _memoryRedis ??= new TestRedis() as unknown as Redis
    return _memoryRedis
  }

  if (!_redis) {
    _redis = new Redis({ url: env.upstashRedisRestUrl, token: env.upstashRedisRestToken })
  }
  return _redis
}
