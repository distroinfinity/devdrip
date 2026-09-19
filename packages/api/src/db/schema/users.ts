import { pgTable, uuid, varchar, bigint, integer, timestamp } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).notNull().unique(),
  githubLogin: varchar("github_login", { length: 255 }).notNull(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  avatarUrl: varchar("avatar_url", { length: 512 }).notNull(),
  reposCount: integer("repos_count"),
  primaryLanguage: varchar("primary_language", { length: 100 }),
  signedUpAt: timestamp("signed_up_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
