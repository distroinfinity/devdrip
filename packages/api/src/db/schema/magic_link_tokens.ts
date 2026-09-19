import { pgTable, uuid, text, timestamp, index } from "drizzle-orm/pg-core"

export const magicLinkTokens = pgTable(
  "magic_link_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    pairingCode: text("pairing_code"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailIdx: index("magic_link_tokens_email_idx").on(t.email),
    expiresAtIdx: index("magic_link_tokens_expires_at_idx").on(t.expiresAt),
  })
)
