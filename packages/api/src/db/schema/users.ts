import {
  pgTable,
  uuid,
  varchar,
  bigint,
  integer,
  timestamp,
  boolean,
  numeric,
} from "drizzle-orm/pg-core"

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  githubId: bigint("github_id", { mode: "number" }).unique(),
  githubLogin: varchar("github_login", { length: 255 }),
  email: varchar("email", { length: 255 }).unique().notNull(),
  avatarUrl: varchar("avatar_url", { length: 512 }),
  reposCount: integer("repos_count"),
  primaryLanguage: varchar("primary_language", { length: 100 }),
  walletAddress: varchar("wallet_address", { length: 42 }),
  // World identity (added in PR1 — populated by Mini App auth in PR2)
  // NUMERIC(78,0) holds a 256-bit nullifier hash exactly without precision loss.
  nullifierHash: numeric("nullifier_hash", { precision: 78, scale: 0 }).unique(),
  verificationLevel: varchar("verification_level", { length: 16 }),
  signedUpAt: timestamp("signed_up_at", { withTimezone: true }),
  referralCode: varchar("referral_code", { length: 20 }).unique().notNull(),
  tosAcceptedAt: timestamp("tos_accepted_at", { withTimezone: true }),
  streakDays: integer("streak_days").notNull().default(0),
  dataSharingConsent: boolean("data_sharing_consent").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
