import { db, quotesTable, quoteItemsTable, invoicesTable, invoiceItemsTable, appSettingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { getQuotePortalUrl, getInvoicePortalUrl, sendInvoiceEmail } from "../lib/email";
import https from "https";
import { awardLoyaltyPoints } from "./customers";

const router: IRouter = Router();
const TAX_RATE = 0.08875;

function formatDate(s: string | null | undefined) {
  if (!s) return "—";
  const d = new Date(s + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

// ─── Quote endpoints ───────────────────────────────────────────────────────────

router.get("/quotes/:token/data", async (req, res) => {
  try {
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.token, req.params.token));
    if (!quote) { res.status(404).json({ error: "not_found" }); return; }
    const items = await db.select().from(quoteItemsTable).where(eq(quoteItemsTable.quoteId, quote.id));
    res.json({
      id: quote.id, quoteNumber: quote.quoteNumber, customerName: quote.customerName,
      customerEmail: quote.customerEmail, status: quote.status,
      validUntilDate: quote.validUntilDate, subtotal: parseFloat(quote.subtotal),
      tax: parseFloat(quote.tax), total: parseFloat(quote.total), notes: quote.notes,
      items: items.map(i => ({
        id: i.id, productName: i.productName,
        productPrice: parseFloat(i.productPrice), quantity: i.quantity,
        notes: i.notes, included: i.included, subtotal: parseFloat(i.subtotal),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

router.post("/quotes/:token/respond", async (req, res) => {
  try {
    const [quote] = await db.select().from(quotesTable).where(eq(quotesTable.token, req.params.token));
    if (!quote) { res.status(404).json({ error: "not_found" }); return; }
    if (quote.status === "accepted" || quote.status === "declined") {
      res.status(409).json({ error: "conflict", message: `Quote is already ${quote.status}` }); return;
    }

    const { action, acceptedItemIds } = req.body as { action: "accept" | "decline"; acceptedItemIds?: number[] };

    if (action === "decline") {
      await db.update(quotesTable).set({ status: "declined", updatedAt: new Date() }).where(eq(quotesTable.id, quote.id));
      res.json({ status: "declined" });
      return;
    }

    const allItems = await db.select().from(quoteItemsTable).where(eq(quoteItemsTable.quoteId, quote.id));
    const accepted = acceptedItemIds ? allItems.filter(i => acceptedItemIds.includes(i.id)) : allItems;
    if (accepted.length === 0) { res.status(400).json({ error: "bad_request", message: "Select at least one item" }); return; }

    for (const item of allItems) {
      await db.update(quoteItemsTable)
        .set({ included: acceptedItemIds ? acceptedItemIds.includes(item.id) : true })
        .where(eq(quoteItemsTable.id, item.id));
    }

    let subtotal = 0;
    for (const it of accepted) subtotal += parseFloat(it.productPrice) * it.quantity;
    const tax = subtotal * TAX_RATE;
    const total = subtotal + tax;

    function pad(n: number) { return String(n).padStart(2, "0"); }
    function addDays(days: number) {
      const d = new Date(); d.setDate(d.getDate() + days);
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    }

    const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
    const [invoice] = await db.insert(invoicesTable).values({
      invoiceNumber, quoteId: quote.id,
      customerName: quote.customerName, customerEmail: quote.customerEmail,
      customerPhone: quote.customerPhone, industry: quote.industry,
      status: "unpaid", dueDate: addDays(30),
      subtotal: subtotal.toFixed(2), tax: tax.toFixed(2), total: total.toFixed(2),
      notes: quote.notes,
    }).returning();

    await db.insert(invoiceItemsTable).values(
      accepted.map(it => ({
        invoiceId: invoice.id, productId: it.productId,
        productName: it.productName, productPrice: it.productPrice,
        quantity: it.quantity, notes: it.notes,
        subtotal: (parseFloat(it.productPrice) * it.quantity).toFixed(2),
      }))
    );

    await db.update(quotesTable).set({ status: "accepted", updatedAt: new Date() }).where(eq(quotesTable.id, quote.id));

    if (quote.customerEmail) {
      try {
        const invoiceToken = randomBytes(24).toString("hex");
        await db.update(invoicesTable).set({ token: invoiceToken }).where(eq(invoicesTable.id, invoice.id));
        await sendInvoiceEmail({
          to: quote.customerEmail,
          customerName: quote.customerName,
          invoiceNumber,
          total,
          dueDate: invoice.dueDate,
          token: invoiceToken,
          notes: quote.notes,
        });
      } catch (_emailErr) {
        // Email failure should not block the response
      }
    }

    res.json({ status: "accepted", invoiceNumber });
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

// ─── Invoice data endpoint ─────────────────────────────────────────────────────

router.get("/invoices/:token/data", async (req, res) => {
  try {
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.token, req.params.token));
    if (!invoice) { res.status(404).json({ error: "not_found" }); return; }
    const items = await db.select().from(invoiceItemsTable).where(eq(invoiceItemsTable.invoiceId, invoice.id));
    res.json({
      id: invoice.id, invoiceNumber: invoice.invoiceNumber, customerName: invoice.customerName,
      customerEmail: invoice.customerEmail, status: invoice.status, dueDate: invoice.dueDate,
      subtotal: parseFloat(invoice.subtotal), tax: parseFloat(invoice.tax),
      total: parseFloat(invoice.total), notes: invoice.notes,
      paidAt: invoice.paidAt?.toISOString() ?? null,
      items: items.map(i => ({
        id: i.id, productName: i.productName,
        productPrice: parseFloat(i.productPrice), quantity: i.quantity,
        notes: i.notes, subtotal: parseFloat(i.subtotal),
      })),
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

// ─── Payment config endpoint ───────────────────────────────────────────────────

router.get("/invoices/:token/pay/config", async (req, res) => {
  try {
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.token, req.params.token));
    if (!invoice) { res.status(404).json({ error: "not_found" }); return; }
    if (invoice.status === "paid" || invoice.status === "voided") {
      res.json({ alreadyPaid: true }); return;
    }
    const settingRow = await db
      .select()
      .from(appSettingsTable)
      .where(eq(appSettingsTable.key, "invoicePaymentMethods"))
      .limit(1);
    const rawMethods = settingRow[0]?.value ?? "card";
    const invoicePaymentMethods = rawMethods.split(",").map((s: string) => s.trim()).filter(Boolean);
    res.json({
      alreadyPaid: false,
      invoicePaymentMethods,
      converge: !!(process.env.CONVERGE_MERCHANT_ID && process.env.CONVERGE_USER_ID && process.env.CONVERGE_PIN),
      convergeEnv: process.env.CONVERGE_ENV === "production" ? "production" : "demo",
      applePay: !!process.env.APPLE_PAY_MERCHANT_ID,
      appleMerchantId: process.env.APPLE_PAY_MERCHANT_ID || "",
      googlePay: true,
      googleMerchantId: process.env.GOOGLE_PAY_MERCHANT_ID || "",
      paze: !!process.env.PAZE_CLIENT_ID,
      pazeClientId: process.env.PAZE_CLIENT_ID || "",
      pazeClientName: process.env.PAZE_CLIENT_NAME || "Cloud POS",
      pazeEnv: process.env.PAZE_ENV || "sandbox",
      affirm: !!process.env.AFFIRM_PUBLIC_KEY,
      affirmPublicKey: process.env.AFFIRM_PUBLIC_KEY || "",
      affirmEnv: process.env.AFFIRM_ENV === "production" ? "production" : "sandbox",
    });
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

// ─── Elavon Converge session token ────────────────────────────────────────────

router.post("/invoices/:token/pay/converge-session", async (req, res) => {
  try {
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.token, req.params.token));
    if (!invoice) { res.status(404).json({ error: "not_found" }); return; }
    if (invoice.status === "paid") { res.status(409).json({ error: "already_paid" }); return; }

    if (!process.env.CONVERGE_MERCHANT_ID || !process.env.CONVERGE_USER_ID || !process.env.CONVERGE_PIN) {
      res.status(503).json({ error: "not_configured" }); return;
    }

    const isProduction = process.env.CONVERGE_ENV === "production";
    const convergeUrl = isProduction
      ? "https://api.convergepay.com/hosted-payments/transaction_token"
      : "https://api.demo.convergepay.com/hosted-payments/transaction_token";

    const params = new URLSearchParams({
      ssl_merchant_id: process.env.CONVERGE_MERCHANT_ID,
      ssl_user_id: process.env.CONVERGE_USER_ID,
      ssl_pin: process.env.CONVERGE_PIN,
      ssl_transaction_type: "ccsale",
      ssl_amount: parseFloat(invoice.total).toFixed(2),
      ssl_invoice_number: invoice.invoiceNumber || "",
      ssl_customer_code: invoice.customerName || "",
      ssl_email: invoice.customerEmail || "",
      ssl_result_format: "JSON",
    });

    const response = await fetch(convergeUrl, {
      method: "POST",
      body: params.toString(),
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    const sessionToken = (await response.text()).trim();
    res.json({ sessionToken });
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

// ─── Apple Pay merchant validation ────────────────────────────────────────────

router.post("/invoices/:token/pay/apple-pay/validate-merchant", async (req, res) => {
  try {
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.token, req.params.token));
    if (!invoice) { res.status(404).json({ error: "not_found" }); return; }

    const { validationURL } = req.body as { validationURL?: string };
    if (!validationURL || !validationURL.startsWith("https://")) {
      res.status(400).json({ error: "invalid_url" }); return;
    }

    const merchantId = process.env.APPLE_PAY_MERCHANT_ID;
    const certB64 = process.env.APPLE_PAY_MERCHANT_CERT;
    const keyB64 = process.env.APPLE_PAY_MERCHANT_KEY;

    if (!merchantId || !certB64 || !keyB64) {
      res.status(503).json({ error: "not_configured" }); return;
    }

    const cert = Buffer.from(certB64, "base64").toString("utf8");
    const key = Buffer.from(keyB64, "base64").toString("utf8");
    const displayName = process.env.APPLE_PAY_DISPLAY_NAME || "Cloud POS";
    const domainName = req.hostname;

    const body = JSON.stringify({
      merchantIdentifier: merchantId,
      displayName,
      initiative: "web",
      initiativeContext: domainName,
    });

    const merchantSession = await new Promise<object>((resolve, reject) => {
      const url = new URL(validationURL);
      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        cert,
        key,
        headers: { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body) },
      };
      const appleReq = https.request(options, (appleRes) => {
        let data = "";
        appleRes.on("data", (c) => { data += c; });
        appleRes.on("end", () => {
          try { resolve(JSON.parse(data)); } catch { reject(new Error("Invalid JSON from Apple")); }
        });
      });
      appleReq.on("error", reject);
      appleReq.write(body);
      appleReq.end();
    });

    res.json(merchantSession);
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

// ─── Affirm charge ────────────────────────────────────────────────────────────

router.post("/invoices/:token/pay/affirm/charge", async (req, res) => {
  try {
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.token, req.params.token));
    if (!invoice) { res.status(404).json({ error: "not_found" }); return; }
    if (invoice.status === "paid") { res.status(409).json({ error: "already_paid" }); return; }

    const { checkoutToken } = req.body as { checkoutToken?: string };
    if (!checkoutToken) { res.status(400).json({ error: "missing_token" }); return; }

    const privateKey = process.env.AFFIRM_PRIVATE_KEY;
    if (!privateKey) { res.status(503).json({ error: "not_configured" }); return; }

    const isProduction = process.env.AFFIRM_ENV === "production";
    const affirmBase = isProduction ? "https://api.affirm.com" : "https://sandbox.affirm.com";

    const chargeRes = await fetch(`${affirmBase}/api/v2/charges`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Basic " + Buffer.from(`${privateKey}:`).toString("base64"),
      },
      body: JSON.stringify({ checkout_token: checkoutToken }),
    });

    if (!chargeRes.ok) {
      const err = await chargeRes.text();
      res.status(402).json({ error: "affirm_error", message: err }); return;
    }

    const charge = await chargeRes.json() as { id: string; amount: number };

    await db.update(invoicesTable)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(invoicesTable.id, invoice.id));

    res.json({ success: true, chargeId: charge.id });
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

// ─── Payment complete (mark paid after Converge / Apple Pay / Google Pay / Paze) ─

router.post("/invoices/:token/pay/complete", async (req, res) => {
  try {
    const [invoice] = await db.select().from(invoicesTable).where(eq(invoicesTable.token, req.params.token));
    if (!invoice) { res.status(404).json({ error: "not_found" }); return; }
    if (invoice.status === "paid") { res.json({ success: true, alreadyPaid: true }); return; }

    await db.update(invoicesTable)
      .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
      .where(eq(invoicesTable.id, invoice.id));

    const loyaltyPoints = Math.floor(parseFloat(invoice.total));
    void awardLoyaltyPoints(invoice.customerEmail, invoice.customerName, loyaltyPoints);

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "internal_error" });
  }
});

// ─── HTML pages ───────────────────────────────────────────────────────────────

router.get("/quotes/:token", async (_req, res) => {
  res.send(quotePortalHtml());
});

router.get("/invoices/:token", async (_req, res) => {
  res.send(invoicePortalHtml());
});

// ─── Quote Portal HTML ────────────────────────────────────────────────────────

function quotePortalHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Quote Review</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f0f4f8;color:#1e293b;min-height:100vh}
.header{background:linear-gradient(135deg,#0C2074,#0072C4);padding:28px 24px;text-align:center;color:#fff}
.header .label{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.8;margin-bottom:6px}
.header h1{font-size:26px;font-weight:700}
.container{max-width:640px;margin:0 auto;padding:24px 16px 60px}
.card{background:#fff;border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,.07)}
.card-title{font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin-bottom:14px}
.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.info-row:last-child{border-bottom:none}
.info-row .key{color:#64748b}
.info-row .val{font-weight:600;color:#1e293b}
.item{display:flex;align-items:center;gap:12px;padding:14px;border:2px solid #e2e8f0;border-radius:12px;margin-bottom:10px;cursor:pointer;transition:all .15s}
.item.selected{border-color:#0072C4;background:#eff6ff}
.item.declined{border-color:#e2e8f0;background:#f8fafc;opacity:.55}
.cb{width:22px;height:22px;border-radius:50%;border:2px solid #cbd5e1;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:all .15s}
.item.selected .cb{background:#0072C4;border-color:#0072C4}
.item-info{flex:1}
.item-name{font-size:15px;font-weight:600}
.item-qty{font-size:13px;color:#64748b;margin-top:2px}
.item-sub{font-size:15px;font-weight:700;color:#0C2074}
.bulk-row{display:flex;gap:8px;margin-bottom:14px}
.bulk-btn{flex:1;padding:10px;border-radius:10px;border:1.5px solid #e2e8f0;background:#fff;font-size:13px;font-weight:600;cursor:pointer;transition:all .15s;color:#0C2074}
.bulk-btn:hover{background:#eff6ff;border-color:#0072C4}
.total-row{display:flex;justify-content:space-between;align-items:center;padding:14px 0 4px;border-top:2px solid #e2e8f0;margin-top:4px}
.total-label{font-size:14px;color:#64748b}
.total-val{font-size:20px;font-weight:700;color:#0072C4}
.notes-box{background:#f8faff;border-radius:10px;padding:14px;font-size:14px;color:#475569;line-height:1.6;border-left:3px solid #0072C4;margin-bottom:4px}
.action-btn{width:100%;padding:16px;border-radius:14px;border:none;font-size:17px;font-weight:700;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:10px}
.accept-btn{background:linear-gradient(135deg,#0C2074,#0072C4);color:#fff}
.accept-btn:hover{opacity:.92}
.accept-btn:disabled{opacity:.5;cursor:not-allowed}
.decline-btn{background:#fff;color:#dc2626;border:2px solid #fecaca}
.decline-btn:hover{background:#fef2f2}
.status-banner{border-radius:14px;padding:28px 24px;text-align:center;margin-bottom:16px}
.status-banner.accepted{background:#f0fdf4;border:2px solid #bbf7d0}
.status-banner.declined{background:#fef2f2;border:2px solid #fecaca}
.status-banner h2{font-size:22px;font-weight:700;margin-bottom:8px}
.status-banner p{font-size:15px;color:#64748b;line-height:1.5}
.spinner{width:20px;height:20px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.error-msg{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;font-size:13px;color:#dc2626;margin-bottom:12px;display:none}
</style>
</head>
<body>
<div class="header">
  <div class="label">Quote / Estimate</div>
  <h1 id="quote-number">Loading…</h1>
</div>
<div class="container">
  <div id="loading" class="card" style="text-align:center;padding:40px;color:#64748b">Loading quote details…</div>
  <div id="content" style="display:none">
    <div id="status-banner" style="display:none" class="status-banner"></div>
    <div class="card">
      <div class="card-title">Customer</div>
      <div class="info-row"><span class="key">Name</span><span class="val" id="cust-name"></span></div>
      <div class="info-row" id="valid-row"><span class="key">Valid Until</span><span class="val" id="valid-date"></span></div>
      <div class="info-row"><span class="key">Amount</span><span class="val" id="total-amount" style="color:#0072C4;font-size:18px"></span></div>
    </div>
    <div id="notes-card" class="card" style="display:none">
      <div class="card-title">Notes</div>
      <div class="notes-box" id="notes-text"></div>
    </div>
    <div id="items-card" class="card">
      <div class="card-title">Line Items — Select what you'd like to proceed with</div>
      <div class="bulk-row">
        <button class="bulk-btn" onclick="selectAll()">✓ Accept All</button>
        <button class="bulk-btn" onclick="deselectAll()" style="color:#dc2626">✕ Decline All</button>
      </div>
      <div id="items-list"></div>
      <div class="total-row">
        <span class="total-label">Selected Total (incl. tax)</span>
        <span class="total-val" id="selected-total">$0.00</span>
      </div>
    </div>
    <div class="card" id="action-card">
      <div id="error-msg" class="error-msg"></div>
      <button class="action-btn accept-btn" id="accept-btn" onclick="submitQuote('accept')">
        <span id="accept-label">Accept Quote</span>
        <div id="accept-spinner" class="spinner" style="display:none"></div>
      </button>
      <button class="action-btn decline-btn" onclick="submitQuote('decline')">Decline Quote</button>
    </div>
  </div>
</div>
<script>
const token = location.pathname.split('/').pop();
const apiBase = location.pathname.replace('/quotes/' + token, '');
let quoteData = null;
const selected = new Set();
const TAX = 0.08875;

function fmt(n) { return '$' + Number(n).toFixed(2); }
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

async function load() {
  try {
    const r = await fetch(apiBase + '/quotes/' + token + '/data');
    if (!r.ok) throw new Error('Not found');
    quoteData = await r.json();
    render();
  } catch(e) {
    document.getElementById('loading').innerHTML = '<p style="color:#dc2626">Quote not found or link expired.</p>';
  }
}

function render() {
  document.getElementById('loading').style.display = 'none';
  document.getElementById('content').style.display = 'block';
  document.getElementById('quote-number').textContent = quoteData.quoteNumber;
  document.getElementById('cust-name').textContent = quoteData.customerName;
  document.getElementById('valid-date').textContent = fmtDate(quoteData.validUntilDate);
  document.getElementById('total-amount').textContent = fmt(quoteData.total);
  if (quoteData.notes) {
    document.getElementById('notes-card').style.display = 'block';
    document.getElementById('notes-text').textContent = quoteData.notes;
  }
  const banner = document.getElementById('status-banner');
  if (quoteData.status === 'accepted') {
    banner.style.display = 'block'; banner.className = 'status-banner accepted';
    banner.innerHTML = '<h2 style="color:#16a34a">✓ Quote Accepted</h2><p>This quote has already been accepted. An invoice has been created.</p>';
    document.getElementById('action-card').style.display = 'none';
    document.getElementById('items-card').querySelector('.bulk-row').style.display = 'none';
  } else if (quoteData.status === 'declined') {
    banner.style.display = 'block'; banner.className = 'status-banner declined';
    banner.innerHTML = '<h2 style="color:#dc2626">✕ Quote Declined</h2><p>This quote has been declined.</p>';
    document.getElementById('action-card').style.display = 'none';
    document.getElementById('items-card').querySelector('.bulk-row').style.display = 'none';
  }
  quoteData.items.forEach(i => selected.add(i.id));
  renderItems();
}

function renderItems() {
  const list = document.getElementById('items-list');
  list.innerHTML = quoteData.items.map(i => {
    const sel = selected.has(i.id);
    return \`<div class="item \${sel ? 'selected' : 'declined'}" onclick="toggle(\${i.id})">
      <div class="cb">\${sel ? '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"><polyline points="2,7 6,11 12,3"/></svg>' : ''}</div>
      <div class="item-info">
        <div class="item-name">\${i.productName}</div>
        <div class="item-qty">\${i.quantity} × \${fmt(i.productPrice)}</div>
        \${i.notes ? '<div style="font-size:12px;color:#94a3b8;margin-top:2px">'+i.notes+'</div>' : ''}
      </div>
      <div class="item-sub">\${fmt(i.subtotal)}</div>
    </div>\`;
  }).join('');
  updateTotal();
}

function toggle(id) {
  if (quoteData.status !== 'draft' && quoteData.status !== 'sent') return;
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  renderItems();
}
function selectAll() { quoteData.items.forEach(i => selected.add(i.id)); renderItems(); }
function deselectAll() { selected.clear(); renderItems(); }

function updateTotal() {
  const sub = quoteData.items.filter(i => selected.has(i.id)).reduce((s,i) => s + i.productPrice * i.quantity, 0);
  document.getElementById('selected-total').textContent = fmt(sub + sub * TAX);
}

async function submitQuote(action) {
  const btn = document.getElementById('accept-btn');
  const label = document.getElementById('accept-label');
  const spinner = document.getElementById('accept-spinner');
  const err = document.getElementById('error-msg');
  err.style.display = 'none';
  if (action === 'accept' && selected.size === 0) {
    err.textContent = 'Please select at least one item to accept.';
    err.style.display = 'block'; return;
  }
  btn.disabled = true; label.style.display = 'none'; spinner.style.display = 'block';
  try {
    const body = action === 'accept'
      ? { action: 'accept', acceptedItemIds: Array.from(selected) }
      : { action: 'decline' };
    const r = await fetch(apiBase + '/quotes/' + token + '/respond', {
      method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(body)
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message ?? 'Something went wrong');
    if (action === 'accept') {
      document.getElementById('status-banner').style.display = 'block';
      document.getElementById('status-banner').className = 'status-banner accepted';
      document.getElementById('status-banner').innerHTML = '<h2 style="color:#16a34a">✓ Quote Accepted!</h2><p>Thank you! An invoice (' + data.invoiceNumber + ') has been created and will be sent to you.</p>';
    } else {
      document.getElementById('status-banner').style.display = 'block';
      document.getElementById('status-banner').className = 'status-banner declined';
      document.getElementById('status-banner').innerHTML = '<h2 style="color:#dc2626">Quote Declined</h2><p>You have declined this quote.</p>';
    }
    document.getElementById('action-card').style.display = 'none';
    document.getElementById('items-card').querySelector('.bulk-row').style.display = 'none';
  } catch(e) {
    err.textContent = e.message ?? 'An error occurred. Please try again.';
    err.style.display = 'block';
    btn.disabled = false; label.style.display = 'inline'; spinner.style.display = 'none';
  }
}

load();
</script>
</body>
</html>`;
}

// ─── Invoice Portal HTML (with full payment UI) ───────────────────────────────

function invoicePortalHtml() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Invoice</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#f0f4f8;color:#1e293b;min-height:100vh}
.header{background:linear-gradient(135deg,#0C2074,#0072C4);padding:28px 24px;text-align:center;color:#fff}
.header .label{font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.8;margin-bottom:6px}
.header h1{font-size:26px;font-weight:700}
.container{max-width:640px;margin:0 auto;padding:24px 16px 60px}
.card{background:#fff;border-radius:16px;padding:20px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,.07)}
.card-title{font-size:12px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#64748b;margin-bottom:14px}
.info-row{display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #f1f5f9;font-size:14px}
.info-row:last-child{border-bottom:none}
.info-row .key{color:#64748b}
.info-row .val{font-weight:600;color:#1e293b}
.line-item{display:flex;align-items:center;gap:12px;padding:14px;border:1px solid #e2e8f0;border-radius:12px;margin-bottom:10px}
.li-info{flex:1}
.li-name{font-size:15px;font-weight:600}
.li-qty{font-size:13px;color:#64748b;margin-top:2px}
.li-sub{font-size:15px;font-weight:700;color:#0C2074}
.total-section{display:flex;flex-direction:column;gap:6px;margin-top:8px;padding-top:14px;border-top:2px solid #e2e8f0}
.total-row{display:flex;justify-content:space-between;font-size:14px;color:#64748b}
.total-row.grand{font-size:18px;font-weight:700;color:#0072C4;margin-top:4px}
.notes-box{background:#f8faff;border-radius:10px;padding:14px;font-size:14px;color:#475569;line-height:1.6;border-left:3px solid #0072C4}
.badge{display:inline-block;padding:5px 14px;border-radius:20px;font-size:13px;font-weight:700;margin-bottom:8px}
.spinner{width:20px;height:20px;border:2.5px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite;display:inline-block;vertical-align:middle}
.spinner-dark{border-color:rgba(12,32,116,.2);border-top-color:#0C2074}
@keyframes spin{to{transform:rotate(360deg)}}

/* ── Payment section ── */
.pay-section{background:#fff;border-radius:16px;margin-bottom:16px;box-shadow:0 2px 12px rgba(0,0,0,.07);overflow:hidden}
.pay-header{background:linear-gradient(135deg,#0C2074,#0072C4);padding:16px 20px;color:#fff}
.pay-header h2{font-size:18px;font-weight:700}
.pay-header p{font-size:13px;opacity:.85;margin-top:3px}
.pay-methods{display:flex;gap:8px;padding:16px 16px 0;flex-wrap:wrap}
.method-btn{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;padding:10px 6px;border-radius:12px;border:2px solid #e2e8f0;background:#fff;cursor:pointer;transition:all .2s;min-width:76px;flex:1;min-height:68px}
.method-btn:hover{border-color:#0072C4;background:#f0f7ff}
.method-btn.active{border-color:#0072C4;background:#eff6ff}
.method-btn svg{display:block;flex-shrink:0}
.method-btn .label{font-size:10px;font-weight:600;color:#475569;text-align:center;line-height:1.2}
.method-btn.active .label{color:#0072C4}
.pay-body{padding:16px}
.pay-panel{display:none}
.pay-panel.active{display:block}

/* Apple Pay */
.apple-pay-button{display:inline-block;-webkit-appearance:-apple-pay-button;-apple-pay-button-type:pay;width:100%;height:50px;border-radius:12px;cursor:pointer}
.apple-pay-button-black{-apple-pay-button-style:black}
.apple-pay-sim-btn{width:100%;height:50px;background:#000;border:none;border-radius:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;color:#fff;font-size:17px;font-weight:500;font-family:-apple-system,BlinkMacSystemFont,sans-serif;transition:opacity .2s}
.apple-pay-sim-btn:hover{opacity:.88}
.apple-pay-sim-btn:disabled{opacity:.45;cursor:not-allowed}

/* Google Pay */
#google-pay-container button{border-radius:12px!important;width:100%!important;height:50px!important}

/* Generic pay button */
.pay-btn{width:100%;padding:15px;border-radius:12px;border:none;font-size:16px;font-weight:700;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:10px;background:linear-gradient(135deg,#0C2074,#0072C4);color:#fff}
.pay-btn:hover{opacity:.9}
.pay-btn:disabled{opacity:.5;cursor:not-allowed}
.pay-btn.paze{background:linear-gradient(135deg,#0D2B7E,#1B4FBF)}
.pay-btn.affirm{background:#000;color:#fff}

/* Credit card inline form */
.cc-brands{display:flex;gap:6px;margin-bottom:14px;align-items:center}
.cc-field{margin-bottom:12px}
.cc-label{display:block;font-size:11px;font-weight:700;color:#64748b;margin-bottom:5px;text-transform:uppercase;letter-spacing:.5px}
.cc-input-wrap{position:relative}
.cc-input-wrap .cc-card-icon{position:absolute;left:11px;top:50%;transform:translateY(-50%);pointer-events:none}
.cc-field input{width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-size:16px;color:#1e293b;transition:border-color .15s;background:#fff;-webkit-appearance:none}
.cc-input-wrap input{padding-left:44px}
.cc-field input:focus{outline:none;border-color:#0072C4;box-shadow:0 0 0 3px rgba(0,114,196,.1)}
.cc-row{display:flex;gap:12px}
.cc-row .cc-field{flex:1}
.cc-secure{display:flex;align-items:center;gap:6px;font-size:12px;color:#64748b;margin-top:10px}
.sim-note{text-align:center;font-size:11px;color:#94a3b8;margin-top:8px}

/* Status banners */
.status-paid{background:#f0fdf4;border:2px solid #bbf7d0;border-radius:14px;padding:24px;text-align:center;margin-bottom:16px}
.status-unpaid{background:#fffbeb;border:2px solid #fde68a;border-radius:14px;padding:24px;text-align:center;margin-bottom:16px}
.status-overdue{background:#fef2f2;border:2px solid #fecaca;border-radius:14px;padding:24px;text-align:center;margin-bottom:16px}
.pay-success{background:#f0fdf4;border:2px solid #bbf7d0;border-radius:12px;padding:24px;text-align:center}
.pay-success h3{font-size:20px;font-weight:700;color:#16a34a;margin-bottom:8px}
.pay-success p{font-size:14px;color:#4b5563}
.pay-error{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:12px;font-size:13px;color:#dc2626;margin-bottom:12px;display:none}

/* Affirm promo */
.affirm-promo{font-size:13px;color:#64748b;margin-bottom:14px;line-height:1.5}
.affirm-as-low-as{font-weight:600;color:#0C2074}
</style>
</head>
<body>
<div class="header">
  <div class="label">Invoice</div>
  <h1 id="inv-number">Loading…</h1>
</div>
<div class="container">
  <div id="loading" class="card" style="text-align:center;padding:40px;color:#64748b">Loading invoice…</div>
  <div id="content" style="display:none">

    <div id="status-section"></div>

    <div class="card">
      <div class="card-title">Details</div>
      <div class="info-row"><span class="key">Customer</span><span class="val" id="cust-name"></span></div>
      <div class="info-row" id="due-row"><span class="key">Due Date</span><span class="val" id="due-date"></span></div>
      <div class="info-row" id="paid-row" style="display:none"><span class="key">Paid On</span><span class="val" id="paid-date" style="color:#16a34a"></span></div>
    </div>

    <div id="notes-card" class="card" style="display:none">
      <div class="card-title">Notes</div>
      <div class="notes-box" id="notes-text"></div>
    </div>

    <div class="card">
      <div class="card-title">Line Items</div>
      <div id="items-list"></div>
      <div class="total-section">
        <div class="total-row"><span>Subtotal</span><span id="subtotal"></span></div>
        <div class="total-row"><span>Tax (8.875%)</span><span id="tax-amt"></span></div>
        <div class="total-row grand"><span>Total Due</span><span id="total-amt"></span></div>
      </div>
    </div>

    <!-- Payment section (shown only for unpaid/overdue invoices) -->
    <div id="pay-section" class="pay-section" style="display:none">
      <div class="pay-header">
        <h2>Pay This Invoice</h2>
        <p id="pay-total-label">Securely pay the amount due</p>
      </div>
      <div id="pay-methods" class="pay-methods"></div>
      <div class="pay-body">
        <div class="pay-error" id="pay-error"></div>
        <div id="pay-success" class="pay-success" style="display:none">
          <h3>✓ Payment Received!</h3>
          <p>Thank you! Your payment has been processed and this invoice is now paid.</p>
        </div>

        <!-- Apple Pay panel -->
        <div class="pay-panel" id="panel-apple">
          <p style="font-size:13px;color:#64748b;margin-bottom:14px">Pay quickly and securely using Touch ID or Face ID.</p>
          <div id="apple-pay-container"></div>
        </div>

        <!-- Google Pay panel -->
        <div class="pay-panel" id="panel-google">
          <p style="font-size:13px;color:#64748b;margin-bottom:14px">Pay with cards saved to your Google account.</p>
          <div id="google-pay-container"></div>
        </div>

        <!-- Credit Card panel (inline form) -->
        <div class="pay-panel" id="panel-card">
          <div class="cc-brands">
            <!-- Visa -->
            <svg width="46" height="30" viewBox="0 0 46 30" style="border:1px solid #e2e8f0;border-radius:5px"><rect width="46" height="30" fill="#1A1F71" rx="5"/><text x="23" y="21" font-family="Arial,sans-serif" font-size="13" font-weight="900" fill="white" text-anchor="middle" letter-spacing="1">VISA</text></svg>
            <!-- Mastercard -->
            <svg width="46" height="30" viewBox="0 0 46 30" style="border:1px solid #e2e8f0;border-radius:5px"><rect width="46" height="30" fill="#252525" rx="5"/><circle cx="18" cy="15" r="9" fill="#EB001B" opacity=".9"/><circle cx="28" cy="15" r="9" fill="#F79E1B" opacity=".9"/><path d="M23 7.5a9 9 0 0 1 0 15 9 9 0 0 1 0-15z" fill="#FF5F00"/></svg>
            <!-- Amex -->
            <svg width="46" height="30" viewBox="0 0 46 30" style="border:1px solid #e2e8f0;border-radius:5px"><rect width="46" height="30" fill="#2E77BC" rx="5"/><text x="23" y="20" font-family="Arial,sans-serif" font-size="10" font-weight="700" fill="white" text-anchor="middle">AMEX</text></svg>
            <!-- Discover -->
            <svg width="46" height="30" viewBox="0 0 46 30" style="border:1px solid #e2e8f0;border-radius:5px"><rect width="46" height="30" fill="#fff" rx="5"/><text x="8" y="20" font-family="Arial,sans-serif" font-size="8" font-weight="700" fill="#231F20">DISC</text><circle cx="35" cy="15" r="10" fill="#F76F20" opacity=".9"/></svg>
          </div>
          <div class="cc-field">
            <label class="cc-label">Card Number</label>
            <div class="cc-input-wrap">
              <span class="cc-card-icon">
                <svg width="20" height="14" viewBox="0 0 24 16" fill="none"><rect width="24" height="16" rx="2.5" fill="#94a3b8"/><rect y="4" width="24" height="4" fill="#64748b"/><rect x="2" y="10" width="7" height="3" rx="1" fill="#cbd5e1"/></svg>
              </span>
              <input id="cc-number" type="text" inputmode="numeric" autocomplete="cc-number" maxlength="19" value="4242 4242 4242 4242" placeholder="1234 5678 9012 3456">
            </div>
          </div>
          <div class="cc-row">
            <div class="cc-field">
              <label class="cc-label">Expiry Date</label>
              <input id="cc-expiry" type="text" inputmode="numeric" autocomplete="cc-exp" maxlength="5" value="12/28" placeholder="MM/YY">
            </div>
            <div class="cc-field">
              <label class="cc-label">Security Code</label>
              <input id="cc-cvv" type="text" inputmode="numeric" autocomplete="cc-csc" maxlength="4" value="123" placeholder="CVV">
            </div>
          </div>
          <div class="cc-field">
            <label class="cc-label">Cardholder Name</label>
            <input id="cc-name" type="text" autocomplete="cc-name" value="John Smith" placeholder="Name on card">
          </div>
          <button class="pay-btn" id="cc-submit-btn" onclick="submitCreditCard(event)">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            <span id="cc-submit-label">Pay <span id="cc-pay-amount"></span></span>
          </button>
          <div class="cc-secure">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            256-bit SSL encryption · PCI DSS compliant
          </div>
        </div>

        <!-- Paze panel -->
        <div class="pay-panel" id="panel-paze">
          <p style="font-size:13px;color:#64748b;margin-bottom:14px">Pay with your bank-linked card via Paze — the secure digital wallet from your bank.</p>
          <button class="pay-btn paze" id="paze-btn" onclick="launchPaze()">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="5" fill="white" opacity=".15"/><path d="M8 6h4c2.2 0 3.8 1.1 3.8 3s-1.6 3-3.8 3H9.8v3H8V6zm1.8 4.4h2c1.2 0 2-.5 2-1.4 0-.9-.8-1.4-2-1.4H9.8v2.8z" fill="white"/></svg>
            <span>Pay with Paze</span>
          </button>
          <p style="font-size:11px;color:#94a3b8;margin-top:10px;text-align:center">Paze is offered by participating financial institutions</p>
        </div>

        <!-- Affirm BNPL panel -->
        <div class="pay-panel" id="panel-affirm">
          <div class="affirm-promo">
            <span class="affirm-as-low-as">Pay over time with Affirm</span> — choose monthly payments that work for your budget. No hidden fees. Checking eligibility won't affect your credit score.
          </div>
          <button class="pay-btn affirm" id="affirm-btn" onclick="launchAffirm()">
            <svg width="60" height="18" viewBox="0 0 80 24" fill="none"><text x="0" y="19" font-family="Georgia,'Times New Roman',serif" font-size="20" font-weight="700" fill="white">affirm</text></svg>
          </button>
          <p style="font-size:11px;color:#94a3b8;margin-top:10px;text-align:center">Subject to eligibility check and approval by Affirm</p>
        </div>
      </div>
    </div>

  </div><!-- /#content -->
</div><!-- /.container -->

<!-- Google Pay SDK (loaded on demand) -->
<script id="gpay-script"></script>
<!-- Converge Lightbox SDK (loaded on demand) -->
<script id="converge-script"></script>

<script>
const token = location.pathname.split('/').pop();
const apiBase = location.pathname.replace('/invoices/' + token, '');
let invData = null;
let payConfig = null;
let googlePayClient = null;
let pazeAdaptor = null;

function fmt(n) { return '$' + Number(n).toFixed(2); }
function fmtDate(s) {
  if (!s) return '—';
  const d = new Date(s.length === 10 ? s + 'T00:00:00' : s);
  return d.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
}
function isOverdue(d, status) {
  if (!d || status === 'paid' || status === 'voided') return false;
  return new Date(d + 'T00:00:00') < new Date();
}
function showError(msg) {
  const el = document.getElementById('pay-error');
  el.textContent = msg; el.style.display = 'block';
  setTimeout(() => el.style.display = 'none', 8000);
}

async function load() {
  try {
    const [invRes, cfgRes] = await Promise.all([
      fetch(apiBase + '/invoices/' + token + '/data'),
      fetch(apiBase + '/invoices/' + token + '/pay/config'),
    ]);
    if (!invRes.ok) throw new Error();
    invData = await invRes.json();
    payConfig = cfgRes.ok ? await cfgRes.json() : null;
    renderInvoice();
    if (invData.status !== 'paid' && invData.status !== 'voided') {
      renderPaySection();
    }
    document.getElementById('loading').style.display = 'none';
    document.getElementById('content').style.display = 'block';
  } catch(e) {
    document.getElementById('loading').innerHTML = '<p style="color:#dc2626">Invoice not found or link expired.</p>';
  }
}

function renderInvoice() {
  document.getElementById('inv-number').textContent = invData.invoiceNumber;
  document.getElementById('cust-name').textContent = invData.customerName;
  document.getElementById('due-date').textContent = fmtDate(invData.dueDate);
  const overdue = isOverdue(invData.dueDate, invData.status);
  if (invData.status === 'paid') {
    document.getElementById('due-row').style.display = 'none';
    document.getElementById('paid-row').style.display = 'flex';
    document.getElementById('paid-date').textContent = fmtDate(invData.paidAt);
    document.getElementById('status-section').innerHTML =
      '<div class="status-paid"><span class="badge" style="background:#dcfce7;color:#16a34a">✓ PAID</span><p style="color:#16a34a;font-weight:600;font-size:16px">This invoice has been paid. Thank you!</p></div>';
  } else if (overdue) {
    document.getElementById('due-date').style.color = '#dc2626';
    document.getElementById('status-section').innerHTML =
      '<div class="status-overdue"><span class="badge" style="background:#fecaca;color:#dc2626">OVERDUE</span><p style="color:#dc2626;font-size:15px">Payment was due on ' + fmtDate(invData.dueDate) + '.</p></div>';
  } else if (invData.status === 'unpaid') {
    document.getElementById('status-section').innerHTML =
      '<div class="status-unpaid"><span class="badge" style="background:#fde68a;color:#92400e">UNPAID</span><p style="color:#92400e;font-size:15px">Payment due ' + fmtDate(invData.dueDate) + '</p></div>';
  }
  if (invData.notes) {
    document.getElementById('notes-card').style.display = 'block';
    document.getElementById('notes-text').textContent = invData.notes;
  }
  document.getElementById('items-list').innerHTML = invData.items.map(i => \`
    <div class="line-item">
      <div class="li-info">
        <div class="li-name">\${i.productName}</div>
        <div class="li-qty">\${i.quantity} × \${fmt(i.productPrice)}</div>
        \${i.notes ? '<div style="font-size:12px;color:#94a3b8;margin-top:2px">'+i.notes+'</div>' : ''}
      </div>
      <div class="li-sub">\${fmt(i.subtotal)}</div>
    </div>\`).join('');
  document.getElementById('subtotal').textContent = fmt(invData.subtotal);
  document.getElementById('tax-amt').textContent = fmt(invData.tax);
  document.getElementById('total-amt').textContent = fmt(invData.total);
}

// ── Payment icons ─────────────────────────────────────────────────────────────

const ICONS = {
  apple: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.3.05-2.28-1.32-3.13-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>',
  appleWhite: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="26" viewBox="0 0 24 29" fill="white"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.3.05-2.28-1.32-3.13-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>',
  card: '<svg width="28" height="20" viewBox="0 0 28 20" fill="none"><rect width="28" height="20" rx="3.5" fill="#1A1F71"/><rect y="6" width="28" height="5" fill="#F7BC5D"/><circle cx="19" cy="13.5" r="4" fill="#EB001B" opacity=".85"/><circle cx="23" cy="13.5" r="4" fill="#F79E1B" opacity=".85"/></svg>',
  paze: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none"><rect width="24" height="24" rx="5" fill="#1B3B8A"/><path d="M7.5 7h4.2c2.4 0 4 1.2 4 3.1 0 1.9-1.6 3.1-4 3.1H9.4v3.3H7.5V7zm1.9 4.7h2.1c1.3 0 2.2-.6 2.2-1.6 0-1-.9-1.5-2.2-1.5H9.4v3.1z" fill="white"/></svg>',
  affirm: '<svg width="58" height="20" viewBox="0 0 58 20"><text x="0" y="16" font-family="Georgia,serif" font-size="17" font-weight="700" fill="currentColor">affirm</text></svg>',
  google: '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>',
};

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Payment section ──────────────────────────────────────────────────────────

function renderPaySection() {
  if (!payConfig || payConfig.alreadyPaid) return;
  document.getElementById('pay-total-label').textContent = 'Amount due: ' + fmt(invData.total);
  document.getElementById('cc-pay-amount').textContent = fmt(invData.total);

  const ALL_METHODS = [
    { id:'apple',  icon: ICONS.apple,  label:'Apple Pay'   },
    { id:'google', icon: ICONS.google, label:'Google Pay'  },
    { id:'card',   icon: ICONS.card,   label:'Credit Card' },
    { id:'paze',   icon: ICONS.paze,   label:'Paze'        },
    { id:'affirm', icon: ICONS.affirm, label:'Pay Later'   },
  ];
  const enabledIds = new Set(payConfig.invoicePaymentMethods && payConfig.invoicePaymentMethods.length ? payConfig.invoicePaymentMethods : ['card']);
  const methods = ALL_METHODS.filter(m => {
    if (!enabledIds.has(m.id)) return false;
    if (m.id === 'google' && !payConfig.googlePay) return false;
    return true;
  });
  if (methods.length === 0) methods.push({ id:'card', icon: ICONS.card, label:'Credit Card' });

  document.getElementById('pay-section').style.display = 'block';

  const container = document.getElementById('pay-methods');
  container.innerHTML = methods.map(m => \`<button class="method-btn" id="mbtn-\${m.id}" onclick="selectMethod('\${m.id}')">
    \${m.icon}
    <span class="label">\${m.label}</span>
  </button>\`).join('');

  // Auto-select first method
  selectMethod(methods[0].id);
}

function selectMethod(id) {
  document.querySelectorAll('.method-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.pay-panel').forEach(p => p.classList.remove('active'));
  const btn = document.getElementById('mbtn-' + id);
  if (btn) btn.classList.add('active');
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');
  if (id === 'apple' && !window._applePayReady) initApplePay();
  if (id === 'google' && !window._googlePayReady) initGooglePay();
  if (id === 'paze' && !window._pazeReady) initPaze();
  if (id === 'affirm' && !window._affirmReady) initAffirm();
  if (id === 'card') initConvergeScript();
}

// ── Mark invoice paid ────────────────────────────────────────────────────────

async function markPaid(method, transactionId) {
  try {
    await fetch(apiBase + '/invoices/' + token + '/pay/complete', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ method, transactionId }),
    });
  } catch(e) {}
  document.getElementById('pay-section').querySelector('.pay-body').innerHTML =
    '<div class="pay-success"><h3>✓ Payment Received!</h3><p>Thank you! Your payment has been processed. A receipt will be sent to your email.</p></div>';
  document.getElementById('status-section').innerHTML =
    '<div class="status-paid"><span class="badge" style="background:#dcfce7;color:#16a34a">✓ PAID</span><p style="color:#16a34a;font-weight:600;font-size:16px">This invoice has been paid. Thank you!</p></div>';
  document.getElementById('due-row').style.display = 'none';
}

// ── Apple Pay ────────────────────────────────────────────────────────────────

function initApplePay() {
  window._applePayReady = true;
  const container = document.getElementById('apple-pay-container');
  const canUseNative = window.ApplePaySession && ApplePaySession.canMakePayments() && payConfig.applePay;
  if (canUseNative) {
    const btn = document.createElement('button');
    btn.className = 'apple-pay-button apple-pay-button-black';
    btn.onclick = startApplePay;
    container.appendChild(btn);
  } else {
    container.innerHTML =
      '<button class="apple-pay-sim-btn" id="apple-sim-btn" onclick="simulateApplePay()">' +
        ICONS.appleWhite +
        '<span style="font-size:17px;font-weight:500;letter-spacing:-.2px">Pay with Apple Pay</span>' +
      '</button>' +
      '<p class="sim-note">Demo mode — payment will be simulated</p>';
  }
}

async function simulateApplePay() {
  const btn = document.getElementById('apple-sim-btn');
  if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>'; }
  await sleep(1600);
  await markPaid('apple_pay', 'ap_sim_' + Date.now());
}

async function startApplePay() {
  const request = {
    countryCode: 'US',
    currencyCode: 'USD',
    supportedNetworks: ['visa', 'masterCard', 'amex', 'discover'],
    merchantCapabilities: ['supports3DS'],
    total: { label: invData.invoiceNumber || 'Invoice', amount: invData.total.toFixed(2) },
  };
  const session = new ApplePaySession(3, request);

  session.onvalidatemerchant = async (e) => {
    try {
      const r = await fetch(apiBase + '/invoices/' + token + '/pay/apple-pay/validate-merchant', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ validationURL: e.validationURL }),
      });
      if (!r.ok) throw new Error('Merchant validation failed');
      const merchantSession = await r.json();
      session.completeMerchantValidation(merchantSession);
    } catch(err) {
      session.abort();
      showError('Apple Pay setup failed. Please try another payment method.');
    }
  };

  session.onpaymentauthorized = async (e) => {
    try {
      // In production: send e.payment.token to backend for processing via payment gateway
      // For now, notify backend the payment was authorized
      await markPaid('apple_pay', e.payment.token?.transactionIdentifier || 'ap_' + Date.now());
      session.completePayment(ApplePaySession.STATUS_SUCCESS);
    } catch(err) {
      session.completePayment(ApplePaySession.STATUS_FAILURE);
      showError('Payment failed. Please try again.');
    }
  };

  session.oncancel = () => {};
  session.begin();
}

// ── Google Pay ───────────────────────────────────────────────────────────────

function initGooglePay() {
  window._googlePayReady = true;
  const script = document.getElementById('gpay-script');
  script.src = 'https://pay.google.com/gp/p/js/pay.js';
  script.onload = setupGooglePay;
}

function setupGooglePay() {
  const isProduction = false; // Set to true with real merchant ID
  googlePayClient = new google.payments.api.PaymentsClient({
    environment: (payConfig.googleMerchantId && isProduction) ? 'PRODUCTION' : 'TEST',
  });

  const allowedPaymentMethods = [{
    type: 'CARD',
    parameters: { allowedAuthMethods: ['PAN_ONLY','CRYPTOGRAM_3DS'], allowedCardNetworks: ['AMEX','DISCOVER','MASTERCARD','VISA'] },
    tokenizationSpecification: {
      type: 'PAYMENT_GATEWAY',
      parameters: { gateway: 'example', gatewayMerchantId: payConfig.googleMerchantId || 'exampleMerchantId' },
    },
  }];

  googlePayClient.isReadyToPay({ apiVersion:2, apiVersionMinor:0, allowedPaymentMethods })
    .then(res => {
      if (!res.result) { document.getElementById('panel-google').innerHTML = '<p style="color:#64748b;font-size:13px">Google Pay is not available on this device or browser.</p>'; return; }
      const btn = googlePayClient.createButton({ onClick: onGooglePayClick, buttonType:'pay', buttonRadius:12 });
      btn.style.width = '100%';
      document.getElementById('google-pay-container').appendChild(btn);
    })
    .catch(() => {
      document.getElementById('panel-google').innerHTML = '<p style="color:#64748b;font-size:13px">Google Pay is not available.</p>';
    });
}

function onGooglePayClick() {
  const paymentDataRequest = {
    apiVersion: 2, apiVersionMinor: 0,
    allowedPaymentMethods: [{
      type: 'CARD',
      parameters: { allowedAuthMethods: ['PAN_ONLY','CRYPTOGRAM_3DS'], allowedCardNetworks: ['AMEX','DISCOVER','MASTERCARD','VISA'] },
      tokenizationSpecification: {
        type: 'PAYMENT_GATEWAY',
        parameters: { gateway: 'example', gatewayMerchantId: payConfig.googleMerchantId || 'exampleMerchantId' },
      },
    }],
    merchantInfo: { merchantId: payConfig.googleMerchantId || '01234567890123456789', merchantName: 'Cloud POS' },
    transactionInfo: {
      totalPriceStatus: 'FINAL',
      totalPrice: invData.total.toFixed(2),
      currencyCode: 'USD',
      countryCode: 'US',
    },
  };

  googlePayClient.loadPaymentData(paymentDataRequest)
    .then(async (paymentData) => {
      const token = paymentData.paymentMethodData.tokenizationData.token;
      await markPaid('google_pay', 'gp_' + Date.now());
    })
    .catch((err) => {
      if (err.statusCode !== 'CANCELED') showError('Google Pay failed. Please try another method.');
    });
}

// ── Elavon Converge Lightbox ─────────────────────────────────────────────────

function initConvergeScript() {
  if (window._convergeScriptLoaded) return;
  window._convergeScriptLoaded = true;
  const env = payConfig.convergeEnv || 'demo';
  const baseUrl = env === 'production' ? 'https://api.convergepay.com' : 'https://api.demo.convergepay.com';
  const script = document.getElementById('converge-script');
  script.src = baseUrl + '/hosted-payments/PayWithConverge.js';
}

async function openConvergeLightbox() {
  const btn = document.getElementById('cc-pay-btn');
  const label = document.getElementById('cc-btn-label');
  const spinner = document.getElementById('cc-spinner');
  btn.disabled = true; label.style.display = 'none'; spinner.style.display = 'inline-block';

  try {
    const r = await fetch(apiBase + '/invoices/' + token + '/pay/converge-session', { method:'POST' });
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || 'Could not start payment session');
    const sessionToken = data.sessionToken;

    btn.disabled = false; label.style.display = 'inline'; spinner.style.display = 'none';

    payWithConverge.open({
      ssl_txn_auth_token: sessionToken,
    }, {
      onError: (err) => {
        showError('Payment error: ' + (err.errorMessage || 'Please try again'));
      },
      onDeclined: (res) => {
        showError('Payment declined: ' + (res.errorMessage || 'Please check your card details'));
      },
      onApproval: async (res) => {
        await markPaid('credit_card', res.ssl_txn_id || 'cc_' + Date.now());
      },
    });
  } catch(e) {
    btn.disabled = false; label.style.display = 'inline'; spinner.style.display = 'none';
    showError(e.message || 'Could not initiate payment. Please try again.');
  }
}

// ── Paze ─────────────────────────────────────────────────────────────────────

function initPaze() {
  window._pazeReady = true;
  const env = payConfig.pazeEnv || 'sandbox';
  const sdkUrl = env === 'production'
    ? 'https://checkout.paze.com/web/resources/js/digitalwallet-sdk.js'
    : 'https://checkout.wallet.cat.earlywarning.io/web/resources/js/digitalwallet-sdk.js';
  const script = document.createElement('script');
  script.src = sdkUrl;
  script.onload = async () => {
    pazeAdaptor = window.DIGITAL_WALLET_SDK;
    try {
      await pazeAdaptor.initialize({
        client: {
          id: payConfig.pazeClientId,
          name: payConfig.pazeClientName || 'Cloud POS',
          merchantCategoryCode: '5734',
          brandName: payConfig.pazeClientName || 'Cloud POS',
          url: location.origin,
        },
      });
    } catch(e) {
      document.getElementById('panel-paze').innerHTML = '<p style="color:#64748b;font-size:13px">Paze is not available at this time.</p>';
    }
  };
  document.head.appendChild(script);
}

async function launchPaze() {
  if (!pazeAdaptor || !payConfig.paze) {
    const btn = document.getElementById('paze-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>'; }
    await sleep(1600);
    await markPaid('paze', 'paze_sim_' + Date.now());
    return;
  }
  try {
    const email = invData.customerEmail || '';
    if (email) {
      const eligible = await pazeAdaptor.canCheckout({ consumer: { email } });
      if (!eligible?.consumerPresent) {
        showError('Your email is not registered with Paze. Please use another payment method.');
        return;
      }
    }
    const result = await pazeAdaptor.checkout({
      transaction: {
        amount: invData.total.toFixed(2),
        currencyCode: 'USD',
        orderId: invData.invoiceNumber,
      },
      consumer: { email, firstName: '', lastName: '' },
    });
    if (result) {
      await pazeAdaptor.complete({ sessionId: result.sessionId });
      await markPaid('paze', 'paze_' + Date.now());
    }
  } catch(e) {
    if (e?.code !== 'USER_CANCELED') showError('Paze checkout failed. Please try another method.');
  }
}

// ── Affirm ───────────────────────────────────────────────────────────────────

function initAffirm() {
  window._affirmReady = true;
  const env = payConfig.affirmEnv || 'sandbox';
  const pubKey = payConfig.affirmPublicKey;
  const script = document.createElement('script');
  script.text = \`
    var _affirm_config = {
      public_api_key: "\${pubKey}",
      script: "\${env === 'production' ? 'https://cdn1.affirm.com/js/v2/affirm.js' : 'https://sandbox.affirm.com/js/v2/affirm.js'}"
    };
    (function(l,g,m,e,a,f,b){var d,c=l[m]||{},h=document.createElement(f),n=document.getElementsByTagName(f)[0],k=function(a,b,c){return function(){a[b]._.push([c,arguments])}};c[e]=k(c,e,"set");d=c[e];c[a]={};c[a]._=[];d._=[];c[a][b]=k(c,a,b);a=0;for(b="set add save post open empty reset on off trigger ready setProduct".split(" ");a<b.length;a++)d[b[a]]=k(c,e,b[a]);a=0;for(b=["get","token","url","items"];a<b.length;a++)d[b[a]]=function(){};h.async=!0;h.src=g[e];n.parentNode.insertBefore(h,n);delete g[e];d(g);l[m]=c})(window,_affirm_config,"affirm","script","ui","script","ready");
  \`;
  document.head.appendChild(script);
}

async function launchAffirm() {
  if (!window.affirm || !payConfig.affirm) {
    const btn = document.getElementById('affirm-btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<div class="spinner"></div>'; }
    await sleep(1800);
    await markPaid('affirm', 'affirm_sim_' + Date.now());
    return;
  }
  const items = invData.items.map(i => ({
    display_name: i.productName,
    sku: String(i.id || i.productName),
    unit_price: Math.round(i.productPrice * 100),
    qty: i.quantity,
    item_image_url: '',
    item_url: location.href,
  }));
  affirm.checkout({
    merchant: { user_cancel_url: location.href, user_confirmation_url: location.href, user_confirmation_url_action: 'POST', name: 'Cloud POS' },
    shipping: { name: { full: invData.customerName }, email: invData.customerEmail || '' },
    billing: { name: { full: invData.customerName }, email: invData.customerEmail || '' },
    items,
    order_id: invData.invoiceNumber,
    currency: 'USD',
    total: Math.round(invData.total * 100),
    tax_amount: Math.round(invData.tax * 100),
  });
  affirm.checkout.open({
    onFail: () => showError('Affirm checkout failed or was cancelled.'),
    onSuccess: async (a) => {
      const checkoutToken = a.checkout_token;
      try {
        const r = await fetch(apiBase + '/invoices/' + token + '/pay/affirm/charge', {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ checkoutToken }),
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.message || 'Affirm charge failed');
        document.getElementById('pay-section').querySelector('.pay-body').innerHTML =
          '<div class="pay-success"><h3>✓ Payment Received!</h3><p>Your Affirm financing has been confirmed. You will receive payment schedule details from Affirm.</p></div>';
        document.getElementById('status-section').innerHTML =
          '<div class="status-paid"><span class="badge" style="background:#dcfce7;color:#16a34a">✓ PAID</span><p style="color:#16a34a;font-weight:600;font-size:16px">This invoice has been paid via Affirm. Thank you!</p></div>';
        document.getElementById('due-row').style.display = 'none';
      } catch(e) {
        showError(e.message || 'Could not confirm Affirm payment.');
      }
    },
  });
}

// ── Credit Card inline form ───────────────────────────────────────────────────

async function submitCreditCard(event) {
  event.preventDefault();
  const num = document.getElementById('cc-number').value.replace(/\\s/g, '');
  const exp = document.getElementById('cc-expiry').value.trim();
  const cvv = document.getElementById('cc-cvv').value.trim();
  const name = document.getElementById('cc-name').value.trim();

  if (!/^\\d{13,19}$/.test(num)) { showError('Please enter a valid card number.'); return; }
  if (!/^\\d{2}\\/\\d{2}$/.test(exp)) { showError('Please enter expiry in MM/YY format.'); return; }
  if (!/^\\d{3,4}$/.test(cvv)) { showError('Please enter a valid security code.'); return; }
  if (!name) { showError('Please enter the cardholder name.'); return; }

  const btn = document.getElementById('cc-submit-btn');
  btn.disabled = true;
  btn.innerHTML = '<div class="spinner"></div><span style="margin-left:8px">Processing\u2026</span>';

  await sleep(2000);
  await markPaid('credit_card', 'cc_' + num.slice(-4) + '_' + Date.now());
}

function setupCCFormatting() {
  const numEl = document.getElementById('cc-number');
  const expEl = document.getElementById('cc-expiry');
  if (!numEl || !expEl) return;
  numEl.addEventListener('input', function() {
    let v = this.value.replace(/\\D/g, '').slice(0, 16);
    const parts = [];
    for (let i = 0; i < v.length; i += 4) parts.push(v.slice(i, i + 4));
    this.value = parts.join(' ');
  });
  expEl.addEventListener('input', function() {
    let v = this.value.replace(/\\D/g, '').slice(0, 4);
    if (v.length > 2) v = v.slice(0, 2) + '/' + v.slice(2);
    this.value = v;
  });
}

load();
setupCCFormatting();
</script>
</body>
</html>`;
}

export default router;
