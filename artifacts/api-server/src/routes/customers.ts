import { db, customersTable, quotesTable, quoteItemsTable, invoicesTable, invoiceItemsTable, ordersTable, orderItemsTable } from "@workspace/db";
import { eq, desc, ilike, or, inArray } from "drizzle-orm";
import { Router, type IRouter } from "express";

const router: IRouter = Router();

const CLOUD_POS_URL = "https://cloud-po-s-wilcoxisaac.replit.app";

type CloudPosCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  points: number;
  tier: string;
  visits: number;
  total_spend: number;
  last_visit: string;
  notes: string;
};

export function getTierInfo(pts: number) {
  if (pts >= 5000) return { tier: "Platinum", color: "#7C3AED", bg: "#7C3AED18", nextTier: null as string | null, nextThreshold: 5000, progress: 1 };
  if (pts >= 2000) return { tier: "Gold", color: "#D97706", bg: "#D9770618", nextTier: "Platinum", nextThreshold: 5000, progress: (pts - 2000) / 3000 };
  if (pts >= 500) return { tier: "Silver", color: "#6B7280", bg: "#6B728018", nextTier: "Gold", nextThreshold: 2000, progress: (pts - 500) / 1500 };
  return { tier: "Bronze", color: "#B45309", bg: "#B4530918", nextTier: "Silver", nextThreshold: 500, progress: pts / 500 };
}

export async function upsertCustomer(
  name: string,
  email?: string | null,
  phone?: string | null,
): Promise<void> {
  try {
    const nameClean = name.trim();
    const emailClean = email?.trim().toLowerCase() || null;
    const phoneClean = phone?.trim() || null;
    const today = new Date().toISOString().slice(0, 10);

    if (emailClean) {
      const [existing] = await db
        .select()
        .from(customersTable)
        .where(ilike(customersTable.email, emailClean))
        .limit(1);
      if (existing) {
        await db
          .update(customersTable)
          .set({
            name: nameClean,
            phone: phoneClean ?? existing.phone,
            visits: existing.visits + 1,
            lastVisit: today,
            updatedAt: new Date(),
          })
          .where(eq(customersTable.id, existing.id));
        return;
      }
    }

    const [byName] = await db
      .select()
      .from(customersTable)
      .where(ilike(customersTable.name, nameClean))
      .limit(1);
    if (byName) {
      await db
        .update(customersTable)
        .set({
          email: emailClean ?? byName.email,
          phone: phoneClean ?? byName.phone,
          visits: byName.visits + 1,
          lastVisit: today,
          updatedAt: new Date(),
        })
        .where(eq(customersTable.id, byName.id));
      return;
    }

    await db.insert(customersTable).values({
      name: nameClean,
      email: emailClean,
      phone: phoneClean,
      visits: 1,
      lastVisit: today,
    });
  } catch (e) {
    console.warn("upsertCustomer failed (non-fatal):", e);
  }
}

export async function awardLoyaltyPoints(
  email: string | null | undefined,
  name: string,
  points: number,
): Promise<void> {
  try {
    if (!points || points <= 0) return;
    const nameClean = name.trim();
    const emailClean = email?.trim().toLowerCase();

    let customer = null;
    if (emailClean) {
      const [found] = await db.select().from(customersTable).where(ilike(customersTable.email, emailClean)).limit(1);
      customer = found ?? null;
    }
    if (!customer) {
      const [found] = await db.select().from(customersTable).where(ilike(customersTable.name, nameClean)).limit(1);
      customer = found ?? null;
    }
    if (customer) {
      await db
        .update(customersTable)
        .set({ loyaltyPoints: customer.loyaltyPoints + Math.floor(points), updatedAt: new Date() })
        .where(eq(customersTable.id, customer.id));
    }
  } catch (e) {
    console.warn("awardLoyaltyPoints failed (non-fatal):", e);
  }
}

function toCustomerResponse(c: typeof customersTable.$inferSelect) {
  const tier = getTierInfo(c.loyaltyPoints);
  return {
    id: c.id,
    name: c.name,
    email: c.email,
    phone: c.phone,
    loyaltyPoints: c.loyaltyPoints,
    tier: tier.tier,
    tierColor: tier.color,
    tierBg: tier.bg,
    tierNextThreshold: tier.nextThreshold,
    tierProgress: tier.progress,
    visits: c.visits,
    lastVisit: c.lastVisit,
    cloudPosId: c.cloudPosId,
    notes: c.notes,
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  };
}

router.post("/customers/sync", async (req, res) => {
  try {
    let cloudCustomers: CloudPosCustomer[];

    if (Array.isArray(req.body?.customers) && req.body.customers.length > 0) {
      cloudCustomers = req.body.customers as CloudPosCustomer[];
    } else {
      const resp = await fetch(`${CLOUD_POS_URL}/api/customers`);
      if (!resp.ok) {
        res.status(502).json({ error: "upstream_error", message: "Cloud POS did not respond successfully" }); return;
      }
      cloudCustomers = await resp.json() as CloudPosCustomer[];
    }

    let imported = 0;
    let updated = 0;

    for (const cc of cloudCustomers) {
      let existing: typeof customersTable.$inferSelect | null = null;

      if (cc.id) {
        const [byCloudId] = await db.select().from(customersTable).where(eq(customersTable.cloudPosId, cc.id)).limit(1);
        if (byCloudId) existing = byCloudId;
      }
      if (!existing && cc.email) {
        const [byEmail] = await db.select().from(customersTable).where(ilike(customersTable.email, cc.email)).limit(1);
        if (byEmail) existing = byEmail;
      }
      if (!existing && cc.name) {
        const [byName] = await db.select().from(customersTable).where(ilike(customersTable.name, cc.name)).limit(1);
        if (byName) existing = byName;
      }

      if (existing) {
        const mergedPoints = Math.max(existing.loyaltyPoints, cc.points);
        const mergedVisits = Math.max(existing.visits, cc.visits);
        const mergedLastVisit = (() => {
          if (!existing.lastVisit) return cc.last_visit || null;
          if (!cc.last_visit) return existing.lastVisit;
          return existing.lastVisit > cc.last_visit ? existing.lastVisit : cc.last_visit;
        })();
        await db.update(customersTable)
          .set({
            cloudPosId: cc.id,
            name: cc.name,
            email: cc.email || existing.email,
            phone: cc.phone || existing.phone,
            notes: cc.notes || existing.notes,
            loyaltyPoints: mergedPoints,
            visits: mergedVisits,
            lastVisit: mergedLastVisit,
            updatedAt: new Date(),
          })
          .where(eq(customersTable.id, existing.id));
        updated++;
      } else {
        await db.insert(customersTable).values({
          cloudPosId: cc.id,
          name: cc.name,
          email: cc.email || null,
          phone: cc.phone || null,
          notes: cc.notes || null,
          loyaltyPoints: cc.points,
          visits: cc.visits,
          lastVisit: cc.last_visit || null,
        });
        imported++;
      }
    }

    res.json({ success: true, imported, updated, total: cloudCustomers.length });
  } catch (err) {
    req.log.error(err, "Failed to sync customers from Cloud POS");
    res.status(500).json({ error: "sync_failed", message: "Failed to sync from Cloud POS" });
  }
});

router.get("/customers", async (req, res) => {
  try {
    const customers = await db.select().from(customersTable).orderBy(desc(customersTable.updatedAt));
    const result = await Promise.all(
      customers.map(async (c) => {
        const invoiceWhere = c.email
          ? or(ilike(invoicesTable.customerEmail, c.email), ilike(invoicesTable.customerName, c.name))
          : ilike(invoicesTable.customerName, c.name);
        const quoteWhere = c.email
          ? or(ilike(quotesTable.customerEmail, c.email), ilike(quotesTable.customerName, c.name))
          : ilike(quotesTable.customerName, c.name);
        const orderWhere = ilike(ordersTable.customerName, c.name);

        const [invRows, quoteRows, orderRows] = await Promise.all([
          db.select({ id: invoicesTable.id, total: invoicesTable.total, status: invoicesTable.status })
            .from(invoicesTable).where(invoiceWhere!),
          db.select({ id: quotesTable.id }).from(quotesTable).where(quoteWhere!),
          db.select({ id: ordersTable.id, total: ordersTable.total, status: ordersTable.status })
            .from(ordersTable).where(orderWhere),
        ]);

        const totalSpend =
          invRows.filter((i) => i.status === "paid").reduce((s, i) => s + parseFloat(i.total), 0) +
          orderRows.filter((o) => o.status === "paid").reduce((s, o) => s + parseFloat(o.total ?? "0"), 0);

        return {
          ...toCustomerResponse(c),
          quoteCount: quoteRows.length,
          invoiceCount: invRows.length,
          orderCount: orderRows.length,
          totalSpend: parseFloat(totalSpend.toFixed(2)),
        };
      }),
    );
    res.json(result);
  } catch (err) {
    req.log.error(err, "Failed to list customers");
    res.status(500).json({ error: "internal_error", message: "Failed to list customers" });
  }
});

router.get("/customers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "bad_request" }); return; }
    const [customer] = await db.select().from(customersTable).where(eq(customersTable.id, id));
    if (!customer) { res.status(404).json({ error: "not_found", message: "Customer not found" }); return; }

    const invoiceWhere = customer.email
      ? or(ilike(invoicesTable.customerEmail, customer.email), ilike(invoicesTable.customerName, customer.name))
      : ilike(invoicesTable.customerName, customer.name);
    const quoteWhere = customer.email
      ? or(ilike(quotesTable.customerEmail, customer.email), ilike(quotesTable.customerName, customer.name))
      : ilike(quotesTable.customerName, customer.name);
    const orderWhere = ilike(ordersTable.customerName, customer.name);

    const [invoices, quotes, orders] = await Promise.all([
      db.select().from(invoicesTable).where(invoiceWhere!).orderBy(desc(invoicesTable.createdAt)),
      db.select().from(quotesTable).where(quoteWhere!).orderBy(desc(quotesTable.createdAt)),
      db.select().from(ordersTable).where(orderWhere).orderBy(desc(ordersTable.createdAt)),
    ]);

    const invoiceIds = invoices.map((i) => i.id);
    const quoteIds = quotes.map((q) => q.id);
    const orderIds = orders.map((o) => o.id);

    const [invItems, quoteItems, orderItems] = await Promise.all([
      invoiceIds.length > 0 ? db.select().from(invoiceItemsTable).where(inArray(invoiceItemsTable.invoiceId, invoiceIds)) : Promise.resolve([]),
      quoteIds.length > 0 ? db.select().from(quoteItemsTable).where(inArray(quoteItemsTable.quoteId, quoteIds)) : Promise.resolve([]),
      orderIds.length > 0 ? db.select().from(orderItemsTable).where(inArray(orderItemsTable.orderId, orderIds)) : Promise.resolve([]),
    ]);

    const paidInvoices = invoices.filter((i) => i.paidAt !== null);
    const avgInvoicePayDays =
      paidInvoices.length > 0
        ? paidInvoices.reduce((sum, i) => sum + (i.paidAt!.getTime() - i.createdAt.getTime()) / 86400000, 0) / paidInvoices.length
        : null;

    const acceptedQuotes = quotes.filter((q) => q.status === "accepted");
    const avgQuoteAcceptDays =
      acceptedQuotes.length > 0
        ? acceptedQuotes.reduce((sum, q) => sum + (q.updatedAt.getTime() - q.createdAt.getTime()) / 86400000, 0) / acceptedQuotes.length
        : null;

    const itemCounts: Record<string, { qty: number; spend: number }> = {};
    const allItems = [
      ...invItems.map((i) => ({ name: i.productName, qty: i.quantity, price: parseFloat(i.productPrice) })),
      ...quoteItems.map((i) => ({ name: i.productName, qty: i.quantity, price: parseFloat(i.productPrice) })),
      ...orderItems.map((i) => ({ name: i.productName, qty: i.quantity, price: parseFloat(i.productPrice ?? "0") })),
    ];
    for (const item of allItems) {
      if (!itemCounts[item.name]) itemCounts[item.name] = { qty: 0, spend: 0 };
      itemCounts[item.name].qty += item.qty;
      itemCounts[item.name].spend += item.qty * item.price;
    }
    const topItems = Object.entries(itemCounts)
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 10)
      .map(([name, { qty, spend }]) => ({ name, qty, spend: parseFloat(spend.toFixed(2)) }));

    const totalSpend =
      paidInvoices.reduce((s, i) => s + parseFloat(i.total), 0) +
      orders.filter((o) => o.status === "paid").reduce((s, o) => s + parseFloat(o.total ?? "0"), 0);

    res.json({
      ...toCustomerResponse(customer),
      stats: {
        quoteCount: quotes.length,
        invoiceCount: invoices.length,
        orderCount: orders.length,
        paidInvoiceCount: paidInvoices.length,
        acceptedQuoteCount: acceptedQuotes.length,
        totalSpend: parseFloat(totalSpend.toFixed(2)),
        avgQuoteAcceptDays: avgQuoteAcceptDays !== null ? parseFloat(avgQuoteAcceptDays.toFixed(1)) : null,
        avgInvoicePayDays: avgInvoicePayDays !== null ? parseFloat(avgInvoicePayDays.toFixed(1)) : null,
        topItems,
      },
      quotes: quotes.map((q) => ({ id: q.id, quoteNumber: q.quoteNumber, status: q.status, total: parseFloat(q.total), createdAt: q.createdAt.toISOString() })),
      invoices: invoices.map((inv) => ({ id: inv.id, invoiceNumber: inv.invoiceNumber, status: inv.status, total: parseFloat(inv.total), paidAt: inv.paidAt?.toISOString() ?? null, createdAt: inv.createdAt.toISOString() })),
      orders: orders.map((o) => ({ id: o.id, orderNumber: o.orderNumber, status: o.status, total: parseFloat(o.total ?? "0"), createdAt: o.createdAt.toISOString() })),
    });
  } catch (err) {
    req.log.error(err, "Failed to get customer");
    res.status(500).json({ error: "internal_error", message: "Failed to get customer" });
  }
});

router.post("/customers", async (req, res) => {
  try {
    const { name, email, phone, notes } = req.body as { name?: string; email?: string; phone?: string; notes?: string };
    if (!name?.trim()) { res.status(400).json({ error: "bad_request", message: "Name is required" }); return; }
    const [customer] = await db.insert(customersTable)
      .values({ name: name.trim(), email: email?.trim() || null, phone: phone?.trim() || null, notes: notes?.trim() || null })
      .returning();
    res.status(201).json(toCustomerResponse(customer));
  } catch (err) {
    req.log.error(err, "Failed to create customer");
    res.status(500).json({ error: "internal_error", message: "Failed to create customer" });
  }
});

router.patch("/customers/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) { res.status(400).json({ error: "bad_request" }); return; }
    const { name, email, phone, notes, loyaltyPoints } = req.body as {
      name?: string; email?: string; phone?: string; notes?: string; loyaltyPoints?: number;
    };
    const updates: Partial<typeof customersTable.$inferInsert> = { updatedAt: new Date() };
    if (name) updates.name = name.trim();
    if (email !== undefined) updates.email = email.trim() || null;
    if (phone !== undefined) updates.phone = phone.trim() || null;
    if (notes !== undefined) updates.notes = notes.trim() || null;
    if (typeof loyaltyPoints === "number") updates.loyaltyPoints = loyaltyPoints;
    const [customer] = await db.update(customersTable).set(updates).where(eq(customersTable.id, id)).returning();
    if (!customer) { res.status(404).json({ error: "not_found", message: "Customer not found" }); return; }
    res.json(toCustomerResponse(customer));
  } catch (err) {
    req.log.error(err, "Failed to update customer");
    res.status(500).json({ error: "internal_error", message: "Failed to update customer" });
  }
});

export default router;
