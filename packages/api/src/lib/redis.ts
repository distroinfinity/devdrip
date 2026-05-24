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

  async set(
    key: string,
    value: unknown,
    opts?: { ex?: number; nx?: boolean }
  ): Promise<"OK" | null> {
    if (opts?.nx && this.read(key)) return null
    const expiresAt = opts?.ex ? Date.now() + opts.ex * 1000 : undefined
    this.store.set(key, {
      value: typeof value === "string" ? value : JSON.stringify(value),
      expiresAt,
    })
    return "OK"
  }

  async get<T = unknown>(key: string): Promise<T | null> {
    const entry = this.read(key)
    if (entry === undefined) return Promise.resolve(null)
    // match real Upstash: stored JSON strings round-trip back as their original type
    try {
      return Promise.resolve(JSON.parse(entry.value as string) as T)
    } catch {
      return Promise.resolve(entry.value as T)
    }
  }

  async getdel<T = unknown>(key: string): Promise<T | null> {
    const entry = this.read(key)
    this.store.delete(key)
    if (entry === undefined) return Promise.resolve(null)
    try {
      return Promise.resolve(JSON.parse(entry.value as string) as T)
    } catch {
      return Promise.resolve(entry.value as T)
    }
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

  async incrby(key: string, delta: number): Promise<number> {
    const current = Number((await this.get(key)) ?? "0")
    const next = current + delta
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
    if (entry) {
      this.store.set(key, { ...entry, expiresAt: Date.now() + seconds * 1000 })
      return 1
    }
    // sets + lists have no TTL store — record an expiry timestamp so lpop/lrange can prune.
    // (sadd/smembers don't honor it yet; lpop does, since pending alerts have a real ttl.)
    if (this.setStore?.has(key)) {
      this.listExpiresAt.set(key, Date.now() + seconds * 1000)
      return 1
    }
    if (this.listStore.has(key)) {
      this.listExpiresAt.set(key, Date.now() + seconds * 1000)
      return 1
    }
    if (this.sortedSetStore?.has(key)) {
      this.listExpiresAt.set(key, Date.now() + seconds * 1000)
      return 1
    }
    return 0
  }

  private listExpiresAt = new Map<string, number>()

  private isListExpired(key: string): boolean {
    const at = this.listExpiresAt.get(key)
    return at !== undefined && at <= Date.now()
  }

  private setStore = new Map<string, Set<string>>()

  async sadd(key: string, member: unknown, ...rest: unknown[]): Promise<number> {
    let s = this.setStore.get(key)
    if (!s) {
      s = new Set()
      this.setStore.set(key, s)
    }
    const members = [member, ...rest]
    let added = 0
    for (const m of members) {
      const str = String(m)
      if (!s.has(str)) {
        s.add(str)
        added += 1
      }
    }
    return added
  }

  async smembers(key: string): Promise<string[]> {
    return Array.from(this.setStore.get(key) ?? [])
  }

  // sorted sets — member → score. backs news:offered per-item aging in dev/test;
  // production uses Upstash's native zset commands.
  private sortedSetStore = new Map<string, Map<string, number>>()

  async zadd(key: string, ...elements: { score: number; member: string }[]): Promise<number> {
    let z = this.sortedSetStore.get(key)
    if (!z) {
      z = new Map()
      this.sortedSetStore.set(key, z)
    }
    let added = 0
    for (const { score, member } of elements) {
      if (!z.has(member)) added += 1
      z.set(member, score)
    }
    return added
  }

  async zremrangebyscore(key: string, min: number, max: number): Promise<number> {
    const z = this.sortedSetStore.get(key)
    if (!z) return 0
    let removed = 0
    for (const [member, score] of z) {
      if (score >= min && score <= max) {
        z.delete(member)
        removed += 1
      }
    }
    return removed
  }

  async zrange(
    key: string,
    min: number,
    max: number,
    opts?: { byScore?: boolean }
  ): Promise<string[]> {
    const z = this.sortedSetStore.get(key)
    if (!z) return []
    const entries = [...z.entries()].sort((a, b) => a[1] - b[1])
    if (opts?.byScore) {
      return entries.filter(([, s]) => s >= min && s <= max).map(([m]) => m)
    }
    // index range (supports the common zrange(key, 0, -1) full-range read)
    const stop = max < 0 ? entries.length + max : max
    return entries.filter((_, i) => i >= min && i <= stop).map(([m]) => m)
  }

  private listStore = new Map<string, unknown[]>()

  async lpush(key: string, ...values: unknown[]): Promise<number> {
    if (this.isListExpired(key)) {
      this.listStore.delete(key)
      this.listExpiresAt.delete(key)
    }
    let list = this.listStore.get(key)
    if (!list) {
      list = []
      this.listStore.set(key, list)
    }
    // lpush prepends — newest at head
    list.unshift(...values)
    return list.length
  }

  async lpop<T = unknown>(key: string): Promise<T | null> {
    if (this.isListExpired(key)) {
      this.listStore.delete(key)
      this.listExpiresAt.delete(key)
      return null
    }
    const list = this.listStore.get(key)
    if (!list || list.length === 0) return null
    return list.shift() as T
  }

  pipeline() {
    const ops: Array<() => Promise<unknown>> = []
    const pipeline = {
      incr: (key: string) => {
        ops.push(() => this.incr(key))
        return pipeline
      },
      incrby: (key: string, delta: number) => {
        ops.push(() => this.incrby(key, delta))
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
  // tests always use in-memory
  if (process.env.NODE_ENV === "test") {
    _memoryRedis ??= new TestRedis() as unknown as Redis
    return _memoryRedis
  }

  // local dev without Upstash: in-memory fallback
  if (process.env.NODE_ENV === "development" && !process.env["UPSTASH_REDIS_REST_URL"]) {
    _memoryRedis ??= new TestRedis() as unknown as Redis
    return _memoryRedis
  }

  // production/staging: require real Redis (env.upstashRedisRestUrl throws if missing)

  if (!_redis) {
    _redis = new Redis({ url: env.upstashRedisRestUrl, token: env.upstashRedisRestToken })
  }
  return _redis
}
