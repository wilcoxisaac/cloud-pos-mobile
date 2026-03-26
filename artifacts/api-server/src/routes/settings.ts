import { Router } from "express";
import { db, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

async function getSetting(key: string, defaultValue: string): Promise<string> {
  const rows = await db
    .select()
    .from(appSettingsTable)
    .where(eq(appSettingsTable.key, key))
    .limit(1);
  return rows[0]?.value ?? defaultValue;
}

async function setSetting(key: string, value: string): Promise<void> {
  await db
    .insert(appSettingsTable)
    .values({ key, value })
    .onConflictDoUpdate({
      target: appSettingsTable.key,
      set: { value, updatedAt: new Date() },
    });
}

router.get("/settings", async (_req, res, next) => {
  try {
    const industry = await getSetting("industry", "restaurant");
    const taxRate = await getSetting("taxRate", "8.0");
    const defaultPaymentTerms = await getSetting("defaultPaymentTerms", "30");
    const rawPayMethods = await getSetting("invoicePaymentMethods", "card");
    const invoicePaymentMethods = rawPayMethods.split(",").map((s) => s.trim()).filter(Boolean);
    res.json({ industry, taxRate, defaultPaymentTerms, invoicePaymentMethods });
  } catch (err) {
    next(err);
  }
});

router.put("/settings", async (req, res, next) => {
  try {
    const { industry, taxRate, defaultPaymentTerms, invoicePaymentMethods } = req.body as {
      industry?: string;
      taxRate?: string;
      defaultPaymentTerms?: string;
      invoicePaymentMethods?: string[];
    };
    const validIndustries = ["restaurant", "retail", "service"];
    if (industry !== undefined) {
      if (!validIndustries.includes(industry)) {
        res.status(400).json({ message: "Invalid industry. Must be restaurant, retail, or service." });
        return;
      }
      await setSetting("industry", industry);
    }
    if (taxRate !== undefined) {
      const rate = parseFloat(taxRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        res.status(400).json({ message: "Invalid tax rate." });
        return;
      }
      await setSetting("taxRate", rate.toFixed(1));
    }
    if (defaultPaymentTerms !== undefined) {
      const days = parseInt(defaultPaymentTerms);
      if (isNaN(days) || days < 0) {
        res.status(400).json({ message: "Invalid payment terms." });
        return;
      }
      await setSetting("defaultPaymentTerms", String(days));
    }
    if (invoicePaymentMethods !== undefined) {
      const validMethods = ["card", "apple", "google", "paze", "affirm"];
      const filtered = invoicePaymentMethods.filter((m) => validMethods.includes(m));
      const value = filtered.length > 0 ? filtered.join(",") : "card";
      await setSetting("invoicePaymentMethods", value);
    }
    const updatedIndustry = await getSetting("industry", "restaurant");
    const updatedTaxRate = await getSetting("taxRate", "8.0");
    const updatedTerms = await getSetting("defaultPaymentTerms", "30");
    const rawPayMethods = await getSetting("invoicePaymentMethods", "card");
    const updatedPayMethods = rawPayMethods.split(",").map((s) => s.trim()).filter(Boolean);
    res.json({ industry: updatedIndustry, taxRate: updatedTaxRate, defaultPaymentTerms: updatedTerms, invoicePaymentMethods: updatedPayMethods });
  } catch (err) {
    next(err);
  }
});

export default router;
