// TODO: add a scheduled job to DELETE FROM refresh_tokens WHERE expires_at < NOW()
// to prevent unbounded table growth. Deferred to a future infra ticket.
import { pgTable, uuid, varchar, timestamp, index } from "drizzle-orm/pg-core"
import { users } from "./users.js"

export const refreshTokens = pgTable(
  "refresh_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).unique().notNull(),
    family: uuid("family").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("refresh_tokens_user_idx").on(t.userId),
    index("refresh_tokens_family_idx").on(t.family),
  ]
)
