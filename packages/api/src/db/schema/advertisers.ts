import { pgTable, uuid, varchar, jsonb, timestamp } from "drizzle-orm/pg-core"

export const advertisers = pgTable("advertisers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: varchar("name", { length: 255 }).notNull(),
  contactEmail: varchar("contact_email", { length: 255 }).unique().notNull(),
  companyName: varchar("company_name", { length: 255 }),
  billingInfo: jsonb("billing_info"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
})
