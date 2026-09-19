import { pgTable, numeric, text, uuid, timestamp, primaryKey } from "drizzle-orm/pg-core"
import { users } from "./users.js"

// World ID anti-replay table. (nullifier, action) is the natural key.
// Same nullifier may legitimately appear under different actions in the future
// (e.g., devdrip-signup vs devdrip-claim-bonus); the action namespacing keeps
// them isolated.
export const nullifiers = pgTable(
  "nullifiers",
  {
    nullifier: numeric("nullifier", { precision: 78, scale: 0 }).notNull(),
    action: text("action").notNull(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    verifiedAt: timestamp("verified_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.nullifier, t.action] })]
)
