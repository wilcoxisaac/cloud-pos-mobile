import {
  db,
  modifierGroupsTable,
  modifierOptionsTable,
  productModifierGroupsTable,
  categoryModifierGroupsTable,
  productsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { z } from "zod/v4";

const router: IRouter = Router();

function toGroupResponse(
  g: typeof modifierGroupsTable.$inferSelect,
  options: (typeof modifierOptionsTable.$inferSelect)[]
) {
  return {
    id: g.id,
    name: g.name,
    description: g.description,
    industryContext: g.industryContext,
    selectionType: g.selectionType,
    minSelections: g.minSelections,
    maxSelections: g.maxSelections,
    isRequired: g.isRequired,
    isActive: g.isActive,
    sortOrder: g.sortOrder,
    options: options
      .filter((o) => o.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((o) => ({
        id: o.id,
        name: o.name,
        priceAdjustment: parseFloat(o.priceAdjustment),
        isDefault: o.isDefault,
        sortOrder: o.sortOrder,
      })),
    createdAt: g.createdAt.toISOString(),
    updatedAt: g.updatedAt.toISOString(),
  };
}

async function getGroupWithOptions(groupId: number) {
  const [group] = await db
    .select()
    .from(modifierGroupsTable)
    .where(eq(modifierGroupsTable.id, groupId));
  if (!group) return null;
  const options = await db
    .select()
    .from(modifierOptionsTable)
    .where(eq(modifierOptionsTable.groupId, groupId));
  return toGroupResponse(group, options);
}

// List modifier groups
router.get("/modifier-groups", async (req, res) => {
  try {
    const industry = req.query.industry as string | undefined;
    const groups = await db
      .select()
      .from(modifierGroupsTable)
      .where(eq(modifierGroupsTable.isActive, true));

    const filtered = industry
      ? groups.filter(
          (g) => g.industryContext === industry || g.industryContext === "all"
        )
      : groups;

    const result = await Promise.all(
      filtered.map(async (g) => {
        const options = await db
          .select()
          .from(modifierOptionsTable)
          .where(eq(modifierOptionsTable.groupId, g.id));
        return toGroupResponse(g, options);
      })
    );
    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to list modifier groups");
    res.status(500).json({ error: "internal_error" });
  }
});

// Create modifier group
router.post("/modifier-groups", async (req, res) => {
  try {
    const schema = z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      industryContext: z.string().default("all"),
      selectionType: z.enum(["single", "multiple"]).default("single"),
      minSelections: z.number().int().default(0),
      maxSelections: z.number().int().nullable().optional(),
      isRequired: z.boolean().default(false),
      sortOrder: z.number().int().default(0),
      options: z
        .array(
          z.object({
            name: z.string().min(1),
            priceAdjustment: z.number().default(0),
            isDefault: z.boolean().default(false),
            sortOrder: z.number().int().default(0),
          })
        )
        .optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.message });
      return;
    }
    const { options, ...groupData } = parsed.data;
    const [group] = await db
      .insert(modifierGroupsTable)
      .values({ ...groupData, maxSelections: groupData.maxSelections ?? null })
      .returning();
    if (options && options.length > 0) {
      await db.insert(modifierOptionsTable).values(
        options.map((o) => ({
          groupId: group.id,
          name: o.name,
          priceAdjustment: String(o.priceAdjustment),
          isDefault: o.isDefault,
          sortOrder: o.sortOrder,
        }))
      );
    }
    const full = await getGroupWithOptions(group.id);
    res.status(201).json(full);
  } catch (err) {
    req.log.error(err, "Failed to create modifier group");
    res.status(500).json({ error: "internal_error" });
  }
});

// Get modifier group detail
router.get("/modifier-groups/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const full = await getGroupWithOptions(id);
    if (!full) { res.status(404).json({ error: "not_found" }); return; }
    res.json(full);
  } catch (err) {
    req.log.error(err, "Failed to get modifier group");
    res.status(500).json({ error: "internal_error" });
  }
});

// Update modifier group
router.patch("/modifier-groups/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({
      name: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      industryContext: z.string().optional(),
      selectionType: z.enum(["single", "multiple"]).optional(),
      minSelections: z.number().int().optional(),
      maxSelections: z.number().int().nullable().optional(),
      isRequired: z.boolean().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.message });
      return;
    }
    await db
      .update(modifierGroupsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(modifierGroupsTable.id, id));
    const full = await getGroupWithOptions(id);
    if (!full) { res.status(404).json({ error: "not_found" }); return; }
    res.json(full);
  } catch (err) {
    req.log.error(err, "Failed to update modifier group");
    res.status(500).json({ error: "internal_error" });
  }
});

// Delete modifier group (soft)
router.delete("/modifier-groups/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db
      .update(modifierGroupsTable)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(modifierGroupsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to delete modifier group");
    res.status(500).json({ error: "internal_error" });
  }
});

// Add option to group
router.post("/modifier-groups/:id/options", async (req, res) => {
  try {
    const groupId = parseInt(req.params.id);
    const schema = z.object({
      name: z.string().min(1),
      priceAdjustment: z.number().default(0),
      isDefault: z.boolean().default(false),
      sortOrder: z.number().int().default(0),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.message });
      return;
    }
    const [opt] = await db
      .insert(modifierOptionsTable)
      .values({ groupId, ...parsed.data, priceAdjustment: String(parsed.data.priceAdjustment) })
      .returning();
    res.status(201).json({
      id: opt.id,
      name: opt.name,
      priceAdjustment: parseFloat(opt.priceAdjustment),
      isDefault: opt.isDefault,
      sortOrder: opt.sortOrder,
    });
  } catch (err) {
    req.log.error(err, "Failed to add modifier option");
    res.status(500).json({ error: "internal_error" });
  }
});

// Update option
router.patch("/modifier-options/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const schema = z.object({
      name: z.string().min(1).optional(),
      priceAdjustment: z.number().optional(),
      isDefault: z.boolean().optional(),
      isActive: z.boolean().optional(),
      sortOrder: z.number().int().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.message });
      return;
    }
    const { priceAdjustment, ...rest } = parsed.data;
    await db
      .update(modifierOptionsTable)
      .set({
        ...rest,
        ...(priceAdjustment !== undefined ? { priceAdjustment: String(priceAdjustment) } : {}),
      })
      .where(eq(modifierOptionsTable.id, id));
    const [opt] = await db.select().from(modifierOptionsTable).where(eq(modifierOptionsTable.id, id));
    if (!opt) { res.status(404).json({ error: "not_found" }); return; }
    res.json({ id: opt.id, name: opt.name, priceAdjustment: parseFloat(opt.priceAdjustment), isDefault: opt.isDefault, sortOrder: opt.sortOrder });
  } catch (err) {
    req.log.error(err, "Failed to update modifier option");
    res.status(500).json({ error: "internal_error" });
  }
});

// Delete option
router.delete("/modifier-options/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(modifierOptionsTable).set({ isActive: false }).where(eq(modifierOptionsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to delete modifier option");
    res.status(500).json({ error: "internal_error" });
  }
});

// Get modifier groups for a product (product-level + category-level, merged and deduped)
router.get("/products/:id/modifier-groups", async (req, res) => {
  try {
    const productId = parseInt(req.params.id);
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, productId));
    if (!product) { res.status(404).json({ error: "not_found" }); return; }

    const productLinks = await db
      .select()
      .from(productModifierGroupsTable)
      .where(eq(productModifierGroupsTable.productId, productId));

    const categoryLinks = await db
      .select()
      .from(categoryModifierGroupsTable)
      .where(
        and(
          eq(categoryModifierGroupsTable.industry, product.industry),
          eq(categoryModifierGroupsTable.category, product.category)
        )
      );

    const seenIds = new Set<number>();
    const allLinks = [
      ...productLinks.map((l) => ({ groupId: l.groupId, sortOrder: l.sortOrder, source: "product" })),
      ...categoryLinks.map((l) => ({ groupId: l.groupId, sortOrder: l.sortOrder, source: "category" })),
    ].filter((l) => {
      if (seenIds.has(l.groupId)) return false;
      seenIds.add(l.groupId);
      return true;
    });

    allLinks.sort((a, b) => a.sortOrder - b.sortOrder);

    const result = await Promise.all(
      allLinks.map(async (l) => getGroupWithOptions(l.groupId))
    );
    res.json(result.filter(Boolean));
  } catch (err) {
    req.log.error(err, "Failed to get product modifiers");
    res.status(500).json({ error: "internal_error" });
  }
});

// Associate modifier group with a product
router.post("/product-modifier-groups", async (req, res) => {
  try {
    const schema = z.object({
      productId: z.number().int(),
      groupId: z.number().int(),
      sortOrder: z.number().int().default(0),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.message });
      return;
    }
    const [link] = await db.insert(productModifierGroupsTable).values(parsed.data).returning();
    res.status(201).json(link);
  } catch (err) {
    req.log.error(err, "Failed to associate modifier group");
    res.status(500).json({ error: "internal_error" });
  }
});

// Remove product-modifier association
router.delete("/product-modifier-groups/:productId/:groupId", async (req, res) => {
  try {
    const productId = parseInt(req.params.productId);
    const groupId = parseInt(req.params.groupId);
    await db
      .delete(productModifierGroupsTable)
      .where(
        and(
          eq(productModifierGroupsTable.productId, productId),
          eq(productModifierGroupsTable.groupId, groupId)
        )
      );
    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to remove product-modifier association");
    res.status(500).json({ error: "internal_error" });
  }
});

// Associate modifier group with a category
router.post("/category-modifier-groups", async (req, res) => {
  try {
    const schema = z.object({
      industry: z.string(),
      category: z.string(),
      groupId: z.number().int(),
      sortOrder: z.number().int().default(0),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.message });
      return;
    }
    const [link] = await db.insert(categoryModifierGroupsTable).values(parsed.data).returning();
    res.status(201).json(link);
  } catch (err) {
    req.log.error(err, "Failed to associate modifier group with category");
    res.status(500).json({ error: "internal_error" });
  }
});

// Remove category-modifier association
router.delete("/category-modifier-groups/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(categoryModifierGroupsTable).where(eq(categoryModifierGroupsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to remove category-modifier association");
    res.status(500).json({ error: "internal_error" });
  }
});

export default router;
