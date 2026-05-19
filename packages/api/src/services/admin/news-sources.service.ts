import { eq, desc } from "drizzle-orm"
import { getDb } from "../../db/index.js"
import { newsSources } from "../../db/schema/news_sources.js"
import { ValidationError } from "../../errors/index.js"

export interface NewsSourceInput {
  channelId: string
  key: string
  kind: string
  url: string
  halfLifeHours: number
  fetchIntervalMin: number
  enabled?: boolean
}

const KEY_RE = /^[a-z0-9-]{1,32}$/

function validate(input: Partial<NewsSourceInput>): void {
  if (input.key !== undefined && !KEY_RE.test(input.key)) throw new ValidationError("invalid_key")
  if (input.url !== undefined) {
    try {
      new URL(input.url)
    } catch {
      throw new ValidationError("invalid_url")
    }
  }
  if (
    input.halfLifeHours !== undefined &&
    (input.halfLifeHours <= 0 || input.halfLifeHours > 168)
  ) {
    throw new ValidationError("invalid_half_life")
  }
  if (
    input.fetchIntervalMin !== undefined &&
    (input.fetchIntervalMin < 1 ||
      input.fetchIntervalMin > 1440 ||
      !Number.isInteger(input.fetchIntervalMin))
  ) {
    throw new ValidationError("invalid_fetch_interval")
  }
}

export async function listNewsSources() {
  const db = getDb()
  return db.select().from(newsSources).orderBy(desc(newsSources.createdAt))
}

export async function createNewsSource(input: NewsSourceInput) {
  validate(input)
  const db = getDb()
  const [row] = await db
    .insert(newsSources)
    .values({
      channelId: input.channelId,
      key: input.key,
      kind: input.kind,
      url: input.url,
      halfLifeHours: input.halfLifeHours,
      fetchIntervalMin: input.fetchIntervalMin,
      enabled: input.enabled ?? true,
    })
    .returning()
  return row
}

export async function updateNewsSource(id: string, patch: Partial<NewsSourceInput>) {
  validate(patch)
  const db = getDb()
  const [row] = await db.update(newsSources).set(patch).where(eq(newsSources.id, id)).returning()
  return row
}

export async function deleteNewsSource(id: string) {
  const db = getDb()
  await db.delete(newsSources).where(eq(newsSources.id, id))
}
