import { db, invoicesTable, invoiceItemsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { sendInvoiceEmail, getInvoicePortalUrl } from "../lib/email";
import { upsertCustomer } from "./customers";

const router: IRouter = Router();

function toInvoiceResponse(inv: typeof invoicesTable.$inferSelect, items: typeof invoiceItemsTable.$inferSelect[]) {
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    quoteId: inv.quoteId,
    customerName: inv.customerName,
    customerEmail: inv.customerEmail,
    customerPhone: inv.customerPhone,
    industry: inv.industry,
    status: inv.status,
    dueDate: inv.dueDate,
    subtotal: parseFloat(inv.subtotal),
    tax: parseFloat(inv.tax),
    total: parseFloat(inv.total),
    notes: inv.notes,
    token: inv.token,
    paidAt: inv.paidAt?.toISOString() ?? null,
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString(),
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      productPrice: parseFloat(i.productPrice),
      quantity: i.quantity,
      notes: i.notes,
      subtotal: parseFloat(i.subtotal),
    })),
  };
}

router.get("/invoices", async (req, res) => {
  try {
    const invoices = await db.select().from(invoicesTable).orderBy(desc(invoicesTable.createdAt));
    const allItems = await db.select().from(invoiceItemsTable);
    const itemsByInvoice = new Map<number, typeof invoiceItemsTable.$inferSelect[]>();
    for (const item of allItems) {
      if (!itemsByInvoice.has(item.invoiceId)) itemsByInvoice.set(item.invoiceId, []);
      itemsByInvoice.get(item.invoiceId)!.push(item);
    }
    res.json(invoices.map((inv) => toInvoiceResponse(inv, itemsByInvoice.get(inv.id) ?? [])));
  } catch (err) {
    req.log.error(err, "Failed to list invoices");
    res.status(500).json({ error: "internal_error", message: "Failed to list invoices" });
  }
});

router.post("/invoices", async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, industry, dueDate, notes, items } =
      req.body as {
        customerName?: string;
        customerEmail?: string;
        customerPhone?: string;
        industry?: string;
        dueDate?: string;
        notes?: string;
        items?: Array<{ productId?: number; productName: string; productPrice: number; quantity: number; notes?: string }>;
      };

    if (!customerName?.trim()) {
      res.status(400).json({ error: "bad_request", message: "Customer name is required" }); return;
    }
    if (!items || items.length === 0) {
      res.status(400).json({ error: "bad_request", message: "At least one item is required" }); return;
    }

    let subtotal = 0;
    for (const it of items) subtotal += (it.productPrice ?? 0) * (it.quantity ?? 1);
    const tax = subtotal * 0.08875;
    const total = subtotal + tax;
    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;

    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      quoteId: null,
      customerName: customerName.trim(),
      customerEmail: customerEmail?.trim() ?? null,
      customerPhone: customerPhone?.trim() ?? null,
      industry: industry ?? "restaurant",
      status: "unpaid",
      dueDate: dueDate ?? null,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      notes: notes?.trim() ?? null,
    }).returning();

    const insertedItems = await db.insert(invoiceItemsTable).values(
      items.map((it) => ({
        invoiceId: invoice.id,
        productId: it.productId ?? null,
        productName: it.productName,
        productPrice: String(it.productPrice),
        quantity: it.quantity,
        notes: it.notes?.trim() ?? null,
        subtotal: (it.productPrice * it.quantity).toFixed(2),
      }))
    ).returning();

    void upsertCustomer(customerName, customerEmail, customerPhone);

    res.status(201).json(toInvoiceResponse(invoice, insertedItems));
  } catch (err) {
    req.log.error(err, "Failed to create invoice");
    res.status(500).json({ error: "internal_error", message: "Failed to create invoice" });
  }
});

router.get("/invoices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
    if (!invoice) { res.status(404).json({ error: "not_found", message: "Invoice not found" }); return; }
    const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
    res.json(toInvoiceResponse(invoice, items));
  } catch (err) {
    req.log.error(err, "Failed to get invoice");
    res.status(500).json({ error: "internal_error", message: "Failed to get invoice" });
  }
});

router.patch("/invoices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, dueDate, notes, customerName, customerEmail, customerPhone } = req.body as {
      status?: string;
      dueDate?: string;
      notes?: string;
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
    };
    const updates: Partial<typeof invoicesTable.$inferInsert> = { updatedAt: new Date() };
    if (status) {
      updates.status = status;
      if (status === "paid") updates.paidAt = new Date();
    }
    if (dueDate !== undefined) updates.dueDate = dueDate;
    if (notes !== undefined) updates.notes = notes;
    if (customerName) updates.customerName = customerName;
    if (customerEmail !== undefined) updates.customerEmail = customerEmail;
    if (customerPhone !== undefined) updates.customerPhone = customerPhone;

    const [invoice] = await db.update(invoicesTable).set(updates).where(eq(invoicesTable.id, id)).returning();
    if (!invoice) { res.status(404).json({ error: "not_found", message: "Invoice not found" }); return; }
    const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
    res.json(toInvoiceResponse(invoice, items));
  } catch (err) {
    req.log.error(err, "Failed to update invoice");
    res.status(500).json({ error: "internal_error", message: "Failed to update invoice" });
  }
});

router.post("/invoices/:id/pay", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [invoice] = await db.update(invoicesTable)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(invoicesTable.id, id))
      .returning();
    if (!invoice) { res.status(404).json({ error: "not_found", message: "Invoice not found" }); return; }
    const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
    res.json(toInvoiceResponse(invoice, items));
  } catch (err) {
    req.log.error(err, "Failed to mark invoice as paid");
    res.status(500).json({ error: "internal_error", message: "Failed to mark invoice as paid" });
  }
});

router.post("/invoices/:id/send", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
    if (!invoice) { res.status(404).json({ error: "not_found", message: "Invoice not found" }); return; }

    let token = invoice.token;
    if (!token) {
      token = randomBytes(24).toString("hex");
      await db.update(invoicesTable).set({ token, updatedAt: new Date() }).where(eq(invoicesTable.id, id));
    }

    const url = getInvoicePortalUrl(token);
    let sent = false;

    if (invoice.customerEmail) {
      try {
        const result = await sendInvoiceEmail({
          to: invoice.customerEmail,
          customerName: invoice.customerName,
          invoiceNumber: invoice.invoiceNumber,
          total: parseFloat(invoice.total),
          dueDate: invoice.dueDate,
          token,
          notes: invoice.notes,
        });
        sent = result.sent;
      } catch (emailErr) {
        req.log.warn(emailErr, "Failed to send invoice email — continuing");
      }
    }

    const [updated] = await db.update(invoicesTable)
      .set({ updatedAt: new Date() })
      .where(eq(invoicesTable.id, id))
      .returning();

    const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, id));
    res.json({ ...toInvoiceResponse(updated, items), portalUrl: url, emailSent: sent });
  } catch (err) {
    req.log.error(err, "Failed to send invoice");
    res.status(500).json({ error: "internal_error", message: "Failed to send invoice" });
  }
});

router.delete("/invoices/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.id, id));
    if (!invoice) { res.status(404).json({ error: "not_found", message: "Invoice not found" }); return; }
    if (invoice.status === "paid") {
      res.status(409).json({ error: "conflict", message: "Cannot delete a paid invoice" }); return;
    }
    await db.delete(invoicesTable).where(eq(invoicesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to delete invoice");
    res.status(500).json({ error: "internal_error", message: "Failed to delete invoice" });
  }
});

export default router;
