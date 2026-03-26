import { db, quotesTable, quoteItemsTable, invoicesTable, invoiceItemsTable, appSettingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { sendQuoteEmail, sendInvoiceEmail, getQuotePortalUrl } from "../lib/email";
import { upsertCustomer } from "./customers";

const router: IRouter = Router();
const TAX_RATE = 0.08875;

function pad(n: number) { return String(n).padStart(2, "0"); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDaysStr(days: number) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

async function getDefaultPaymentTerms(): Promise<number> {
  const rows = await db.select().from(appSettingsTable).where(eq(appSettingsTable.key, "defaultPaymentTerms")).limit(1);
  return parseInt(rows[0]?.value ?? "30");
}

function toQuoteResponse(q: typeof quotesTable.$inferSelect, items: typeof quoteItemsTable.$inferSelect[]) {
  return {
    id: q.id,
    quoteNumber: q.quoteNumber,
    customerName: q.customerName,
    customerEmail: q.customerEmail,
    customerPhone: q.customerPhone,
    industry: q.industry,
    status: q.status,
    validUntilDate: q.validUntilDate,
    subtotal: parseFloat(q.subtotal),
    tax: parseFloat(q.tax),
    total: parseFloat(q.total),
    notes: q.notes,
    token: q.token,
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
    items: items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.productName,
      productPrice: parseFloat(i.productPrice),
      quantity: i.quantity,
      notes: i.notes,
      included: i.included,
      subtotal: parseFloat(i.subtotal),
    })),
  };
}

router.get("/quotes", async (req, res) => {
  try {
    const quotes = await db.select().from(quotesTable).orderBy(desc(quotesTable.createdAt));
    const allItems = await db.select().from(quoteItemsTable);
    const itemsByQuote = new Map<number, typeof quoteItemsTable.$inferSelect[]>();
    for (const item of allItems) {
      if (!itemsByQuote.has(item.quoteId)) itemsByQuote.set(item.quoteId, []);
      itemsByQuote.get(item.quoteId)!.push(item);
    }
    res.json(quotes.map((q) => toQuoteResponse(q, itemsByQuote.get(q.id) ?? [])));
  } catch (err) {
    req.log.error(err, "Failed to list quotes");
    res.status(500).json({ error: "internal_error", message: "Failed to list quotes" });
  }
});

router.post("/quotes", async (req, res) => {
  try {
    const { customerName, customerEmail, customerPhone, industry, validUntilDate, notes, items } =
      req.body as {
        customerName?: string;
        customerEmail?: string;
        customerPhone?: string;
        industry?: string;
        validUntilDate?: string;
        notes?: string;
        items?: Array<{ productId?: number; productName: string; productPrice: number; quantity: number; notes?: string }>;
      };

    if (!customerName?.trim()) {
      res.status(400).json({ error: "bad_request", message: "Customer name is required" });
      return;
    }
    if (!items || items.length === 0) {
      res.status(400).json({ error: "bad_request", message: "At least one line item is required" });
      return;
    }

    const quoteNumber = `Q-${Date.now().toString().slice(-6)}`;
    let subtotal = 0;
    for (const it of items) subtotal += (it.productPrice ?? 0) * (it.quantity ?? 1);
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    const [quote] = await db.insert(quotesTable).values({
      quoteNumber,
      customerName: customerName.trim(),
      customerEmail: customerEmail?.trim() ?? null,
      customerPhone: customerPhone?.trim() ?? null,
      industry: industry ?? "restaurant",
      status: "draft",
      validUntilDate: validUntilDate ?? addDaysStr(30),
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      notes: notes?.trim() ?? null,
    }).returning();

    const insertedItems = await db.insert(quoteItemsTable).values(
      items.map((it) => ({
        quoteId: quote.id,
        productId: it.productId ?? null,
        productName: it.productName,
        productPrice: String(it.productPrice),
        quantity: it.quantity,
        notes: it.notes?.trim() ?? null,
        included: true,
        subtotal: (it.productPrice * it.quantity).toFixed(2),
      }))
    ).returning();

    void upsertCustomer(customerName, customerEmail, customerPhone);

    let responseToken = quote.token;
    let responseStatus = quote.status;

    if (customerEmail?.trim()) {
      try {
        const token = randomBytes(24).toString("hex");
        await db.update(quotesTable)
          .set({ token, status: "sent", updatedAt: new Date() })
          .where(eq(quotesTable.id, quote.id));
        await sendQuoteEmail({
          to: customerEmail.trim(),
          customerName: customerName.trim(),
          quoteNumber,
          total,
          validUntil: validUntilDate ?? addDaysStr(30),
          token,
          notes: notes?.trim() ?? null,
        });
        responseToken = token;
        responseStatus = "sent";
      } catch (emailErr) {
        req.log.warn(emailErr, "Auto-send quote email failed — continuing");
      }
    }

    res.status(201).json(toQuoteResponse(
      { ...quote, token: responseToken, status: responseStatus } as typeof quotesTable.$inferSelect,
      insertedItems,
    ));
  } catch (err) {
    req.log.error(err, "Failed to create quote");
    res.status(500).json({ error: "internal_error", message: "Failed to create quote" });
  }
});

router.get("/quotes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) { res.status(404).json({ error: "not_found", message: "Quote not found" }); return; }
    const items = await db.select().from(quoteItemsTable).where(eq(quoteItemsTable.quoteId, id));
    res.json(toQuoteResponse(quote, items));
  } catch (err) {
    req.log.error(err, "Failed to get quote");
    res.status(500).json({ error: "internal_error", message: "Failed to get quote" });
  }
});

router.patch("/quotes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, customerName, customerEmail, customerPhone, notes, validUntilDate } = req.body as {
      status?: string;
      customerName?: string;
      customerEmail?: string;
      customerPhone?: string;
      notes?: string;
      validUntilDate?: string;
    };
    const updates: Partial<typeof quotesTable.$inferInsert> = { updatedAt: new Date() };
    if (status) updates.status = status;
    if (customerName) updates.customerName = customerName;
    if (customerEmail !== undefined) updates.customerEmail = customerEmail;
    if (customerPhone !== undefined) updates.customerPhone = customerPhone;
    if (notes !== undefined) updates.notes = notes;
    if (validUntilDate) updates.validUntilDate = validUntilDate;

    const [quote] = await db.update(quotesTable).set(updates).where(eq(quotesTable.id, id)).returning();
    if (!quote) { res.status(404).json({ error: "not_found", message: "Quote not found" }); return; }
    const items = await db.select().from(quoteItemsTable).where(eq(quoteItemsTable.quoteId, id));
    res.json(toQuoteResponse(quote, items));
  } catch (err) {
    req.log.error(err, "Failed to update quote");
    res.status(500).json({ error: "internal_error", message: "Failed to update quote" });
  }
});

router.post("/quotes/:id/accept", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { acceptedItemIds, dueDate } = req.body as { acceptedItemIds?: number[]; dueDate?: string };

    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) { res.status(404).json({ error: "not_found", message: "Quote not found" }); return; }
    if (quote.status === "accepted") {
      res.status(409).json({ error: "conflict", message: "Quote has already been accepted" }); return;
    }

    const allItems = await db.select().from(quoteItemsTable).where(eq(quoteItemsTable.quoteId, id));
    const accepted = acceptedItemIds
      ? allItems.filter((i) => acceptedItemIds.includes(i.id))
      : allItems;

    if (accepted.length === 0) {
      res.status(400).json({ error: "bad_request", message: "At least one item must be accepted" }); return;
    }

    for (const item of allItems) {
      await db.update(quoteItemsTable)
        .set({ included: acceptedItemIds ? acceptedItemIds.includes(item.id) : true })
        .where(eq(quoteItemsTable.id, item.id));
    }

    let subtotal = 0;
    for (const it of accepted) subtotal += parseFloat(it.productPrice) * it.quantity;
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;
    const terms = await getDefaultPaymentTerms();
    const finalDueDate = dueDate ?? addDaysStr(terms);

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber,
      quoteId: id,
      customerName: quote.customerName,
      customerEmail: quote.customerEmail,
      customerPhone: quote.customerPhone,
      industry: quote.industry,
      status: "unpaid",
      dueDate: finalDueDate,
      subtotal: subtotal.toFixed(2),
      tax: tax.toFixed(2),
      total: total.toFixed(2),
      notes: quote.notes,
    }).returning();

    const invoiceItems = await db.insert(invoiceItemsTable).values(
      accepted.map((it) => ({
        invoiceId: invoice.id,
        productId: it.productId,
        productName: it.productName,
        productPrice: it.productPrice,
        quantity: it.quantity,
        notes: it.notes,
        subtotal: (parseFloat(it.productPrice) * it.quantity).toFixed(2),
      }))
    ).returning();

    await db.update(quotesTable).set({ status: "accepted", updatedAt: new Date() }).where(eq(quotesTable.id, id));

    let invoiceResponseToken = invoice.token;
    if (quote.customerEmail) {
      try {
        const invoiceToken = randomBytes(24).toString("hex");
        await db.update(invoicesTable)
          .set({ token: invoiceToken })
          .where(eq(invoicesTable.id, invoice.id));
        await sendInvoiceEmail({
          to: quote.customerEmail,
          customerName: quote.customerName,
          invoiceNumber: invoice.invoiceNumber,
          total,
          dueDate: finalDueDate,
          token: invoiceToken,
          notes: quote.notes,
        });
        invoiceResponseToken = invoiceToken;
      } catch (emailErr) {
        req.log.warn(emailErr, "Auto-send invoice email failed — continuing");
      }
    }

    res.status(201).json({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      quoteId: invoice.quoteId,
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerPhone: invoice.customerPhone,
      industry: invoice.industry,
      status: invoice.status,
      dueDate: invoice.dueDate,
      subtotal: parseFloat(invoice.subtotal),
      tax: parseFloat(invoice.tax),
      total: parseFloat(invoice.total),
      notes: invoice.notes,
      token: invoiceResponseToken,
      paidAt: null,
      createdAt: invoice.createdAt.toISOString(),
      updatedAt: invoice.updatedAt.toISOString(),
      items: invoiceItems.map((i) => ({
        id: i.id,
        productId: i.productId,
        productName: i.productName,
        productPrice: parseFloat(i.productPrice),
        quantity: i.quantity,
        notes: i.notes,
        subtotal: parseFloat(i.subtotal),
      })),
    });
  } catch (err) {
    req.log.error(err, "Failed to accept quote");
    res.status(500).json({ error: "internal_error", message: "Failed to accept quote" });
  }
});

router.post("/quotes/:id/send", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) { res.status(404).json({ error: "not_found", message: "Quote not found" }); return; }

    let token = quote.token;
    if (!token) {
      token = randomBytes(24).toString("hex");
      await db.update(quotesTable).set({ token, updatedAt: new Date() }).where(eq(quotesTable.id, id));
    }

    const url = getQuotePortalUrl(token);
    let sent = false;

    if (quote.customerEmail) {
      try {
        const items = await db.select().from(quoteItemsTable).where(eq(quoteItemsTable.quoteId, id));
        const result = await sendQuoteEmail({
          to: quote.customerEmail,
          customerName: quote.customerName,
          quoteNumber: quote.quoteNumber,
          total: parseFloat(quote.total),
          validUntil: quote.validUntilDate,
          token,
          notes: quote.notes,
        });
        sent = result.sent;
      } catch (emailErr) {
        req.log.warn(emailErr, "Failed to send quote email — continuing");
      }
    }

    const [updated] = await db.update(quotesTable)
      .set({ status: "sent", updatedAt: new Date() })
      .where(eq(quotesTable.id, id))
      .returning();

    const items = await db.select().from(quoteItemsTable).where(eq(quoteItemsTable.quoteId, id));
    res.json({ ...toQuoteResponse(updated, items), portalUrl: url, emailSent: sent });
  } catch (err) {
    req.log.error(err, "Failed to send quote");
    res.status(500).json({ error: "internal_error", message: "Failed to send quote" });
  }
});

router.delete("/quotes/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.id, id));
    if (!quote) { res.status(404).json({ error: "not_found", message: "Quote not found" }); return; }
    if (quote.status === "accepted") {
      res.status(409).json({ error: "conflict", message: "Cannot delete an accepted quote" }); return;
    }
    await db.delete(quotesTable).where(eq(quotesTable.id, id));
    res.status(204).send();
  } catch (err) {
    req.log.error(err, "Failed to delete quote");
    res.status(500).json({ error: "internal_error", message: "Failed to delete quote" });
  }
});

export default router;
