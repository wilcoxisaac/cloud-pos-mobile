import {
  boolean, integer, numeric, pgTable, serial, text, timestamp,
} from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const modifierGroupsTable = pgTable("modifier_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  industryContext: text("industry_context").notNull().default("all"),
  selectionType: text("selection_type").notNull().default("single"),
  minSelections: integer("min_selections").notNull().default(0),
  maxSelections: integer("max_selections"),
  isRequired: boolean("is_required").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const modifierOptionsTable = pgTable("modifier_options", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => modifierGroupsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  priceAdjustment: numeric("price_adjustment", { precision: 10, scale: 2 }).notNull().default("0"),
  isDefault: boolean("is_default").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const productModifierGroupsTable = pgTable("product_modifier_groups", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").notNull().references(() => productsTable.id, { onDelete: "cascade" }),
  groupId: integer("group_id").notNull().references(() => modifierGroupsTable.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const categoryModifierGroupsTable = pgTable("category_modifier_groups", {
  id: serial("id").primaryKey(),
  industry: text("industry").notNull(),
  category: text("category").notNull(),
  groupId: integer("group_id").notNull().references(() => modifierGroupsTable.id, { onDelete: "cascade" }),
  sortOrder: integer("sort_order").notNull().default(0),
});

export type ModifierGroup = typeof modifierGroupsTable.$inferSelect;
export type ModifierOption = typeof modifierOptionsTable.$inferSelect;
export type ProductModifierGroup = typeof productModifierGroupsTable.$inferSelect;
export type CategoryModifierGroup = typeof categoryModifierGroupsTable.$inferSelect;
