import { db, productsTable, appSettingsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { insertProductSchema, updateProductSchema } from "@workspace/db/schema";

const router: IRouter = Router();

async function getCurrentIndustry(): Promise<string> {
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, "industry"))
    .limit(1);
  return rows[0]?.value ?? "restaurant";
}

router.get("/products", async (req, res) => {
  try {
    const industry = (req.query.industry as string | undefined) ?? (await getCurrentIndustry());
    const products = await db
      .select()
      .from(productsTable)
      .where(and(eq(productsTable.isActive, true), eq(productsTable.industry, industry)));
    res.json(products.map(toProductResponse));
  } catch (err) {
    req.log.error(err, "Failed to list products");
    res.status(500).json({ error: "internal_error", message: "Failed to list products" });
  }
});

router.post("/products", async (req, res) => {
  try {
    const rawBody = req.body as Record<string, unknown>;
    if (typeof rawBody.price === "number") {
      rawBody.price = String(rawBody.price);
    }
    const parsed = insertProductSchema.safeParse(rawBody);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.message });
      return;
    }
    const [product] = await db.insert(productsTable).values(parsed.data).returning();
    res.status(201).json(toProductResponse(product));
  } catch (err) {
    req.log.error(err, "Failed to create product");
    res.status(500).json({ error: "internal_error", message: "Failed to create product" });
  }
});

router.get("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid product ID" });
      return;
    }
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    if (!product) {
      res.status(404).json({ error: "not_found", message: "Product not found" });
      return;
    }
    res.json(toProductResponse(product));
  } catch (err) {
    req.log.error(err, "Failed to get product");
    res.status(500).json({ error: "internal_error", message: "Failed to get product" });
  }
});

router.patch("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid product ID" });
      return;
    }
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "validation_error", message: parsed.error.message });
      return;
    }
    const [product] = await db
      .update(productsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(productsTable.id, id))
      .returning();
    if (!product) {
      res.status(404).json({ error: "not_found", message: "Product not found" });
      return;
    }
    res.json(toProductResponse(product));
  } catch (err) {
    req.log.error(err, "Failed to update product");
    res.status(500).json({ error: "internal_error", message: "Failed to update product" });
  }
});

router.delete("/products/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      res.status(400).json({ error: "bad_request", message: "Invalid product ID" });
      return;
    }
    await db.update(productsTable).set({ isActive: false }).where(eq(productsTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to delete product");
    res.status(500).json({ error: "internal_error", message: "Failed to delete product" });
  }
});

function toProductResponse(p: typeof productsTable.$inferSelect) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    price: parseFloat(p.price),
    category: p.category,
    industry: p.industry,
    sku: p.sku,
    emoji: p.emoji,
    modifiers: p.modifiers,
    pricingType: p.pricingType ?? "fixed",
    unit: p.unit ?? null,
    isBundle: p.isBundle ?? false,
    bundleItems: p.bundleItems ? JSON.parse(p.bundleItems) : null,
    imageUrl: p.imageUrl,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

export default router;
