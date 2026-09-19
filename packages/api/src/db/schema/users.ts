import { pgTable, uuid, varchar, bigint, integer, timestamp, boolean } from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).unique(),
  githubLogin: varchar("github_login", { length: 255 }),
  email: varchar("email", { length: 255 }).unique().notNull(),
  avatarUrl: varchar("avatar_url", { length: 512 }),
  walletAddress: varchar("wallet_address", { length: 42 }),
  referralCode: varchar("referral_code", { length: 20 }).unique().notNull(),
  tosAcceptedAt: timestamp("tos_accepted_at", { withTimezone: true }),
  streakDays: integer("streak_days").notNull().default(0),
  dataSharingConsent: boolean("data_sharing_consent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
