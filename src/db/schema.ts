import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const tickets = pgTable("tickets", {
  id: text("id").primaryKey(),
  subject: text("subject").notNull(),
  description: text("description").notNull(),
  customerName: text("customerName").notNull(),
  customerEmail: text("customerEmail").notNull(),
  status: text("status").notNull(),
  category: text("category"),
  priority: text("priority"),
  issueSummary: text("issueSummary"),
  suggestedResponse: text("suggestedResponse"),
  createdAt: timestamp("createdAt", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
});
