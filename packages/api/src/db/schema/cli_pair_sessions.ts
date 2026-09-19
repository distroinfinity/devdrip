import { pgTable, text, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core"
import { users } from "./users.js"

// Short-lived (5 min TTL) handshake state for `devdrip login`. Code is the
// human-typeable XXX-XXX-XXX Crockford-base32 string the CLI prints as a QR.
export const cliPairSessions = pgTable(
  "cli_pair_sessions",
  {
    code: text("code").primaryKey(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (t) => [index("cli_pair_sessions_status_idx").on(t.status, t.expiresAt)]
)
