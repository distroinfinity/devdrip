import { pgEnum, pgTable, uuid, varchar, boolean, timestamp, index } from "drizzle-orm/pg-core"
import { users } from "./users.js"

export const referralStatusEnum = pgEnum("referral_status", ["pending", "activated", "paid"])

export const referrals = pgTable(
  "referrals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    referrerId: uuid("referrer_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    refereeId: uuid("referee_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 20 }).notNull(),
    status: referralStatusEnum("status").notNull().default("pending"),
    bonusPaid: boolean("bonus_paid").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("referrals_code_idx").on(t.code)]
)
