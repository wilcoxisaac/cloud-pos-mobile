import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export type IndustryMode = "restaurant" | "retail" | "service";

export const appSettingsTable = pgTable("app_settings", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AppSetting = typeof appSettingsTable.$inferSelect;
