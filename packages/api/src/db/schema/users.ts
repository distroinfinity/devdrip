import { pgTable, uuid, varchar, bigint, integer, timestamp, boolean } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).unique(),
  githubLogin: varchar("github_login", { length: 255 }),
  email: varchar("email", { length: 255 }).unique().notNull(),
  avatarUrl: varchar("avatar_url", { length: 512 }),
  reposCount: integer("repos_count"),
  primaryLanguage: varchar("primary_language", { length: 100 }),
  signedUpAt: timestamp("signed_up_at", { withTimezone: true }),
  referralCode: varchar("referral_code", { length: 20 }).unique().notNull(),
  tosAcceptedAt: timestamp("tos_accepted_at", { withTimezone: true }),
  streakDays: integer("streak_days").notNull().default(0),
  dataSharingConsent: boolean("data_sharing_consent").notNull().default(false),
  // M2: used to throttle magic-link sends (one per 60s)
  magicLinkLastSentAt: timestamp("magic_link_last_sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
