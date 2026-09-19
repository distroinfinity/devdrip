import { pgTable, uuid, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core"

export const channels = pgTable(
  "channels",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // stable string identifier, e.g. 'tech' | 'finance' | 'crypto' | 'ai-papers' | 'design' | 'gaming'
    key: text("key").notNull(),
    label: text("label").notNull(),
    defaultOn: boolean("default_on").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("channels_key_uq").on(t.key)]
)
