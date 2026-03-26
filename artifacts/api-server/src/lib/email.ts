import { Resend } from "resend";

let resend: Resend | null = null;
function getResend(): Resend | null {
  if (resend) return resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  resend = new Resend(key);
  return resend;
}

function getPortalBase(): string {
  // Prefer explicit override (always set this in production via PORTAL_BASE_URL secret)
  if (process.env.PORTAL_BASE_URL) return process.env.PORTAL_BASE_URL.replace(/\/+$/, "") + "/api/portal";

  // In Replit's deployed (autoscale) environment, REPLIT_DOMAINS contains the stable
  // production domain (e.g. "myapp--username.replit.app"), NOT the sleeping dev domain.
  // We prefer any domain that looks like a production replit.app domain.
  const domains = (process.env.REPLIT_DOMAINS ?? "").split(",").map((d) => d.trim()).filter(Boolean);
  const prodDomain = domains.find(
    (d) => d.endsWith(".replit.app") || (!d.includes("riker.replit.dev") && !d.includes("expo.riker.replit.dev")),
  );
  if (prodDomain) return `https://${prodDomain}/api/portal`;

  // Development-only fallback — this domain sleeps and should never appear in emails
  const dev = process.env.REPLIT_DEV_DOMAIN;
  if (dev) return `https://${dev}/api/portal`;
  return `http://localhost:${process.env.PORT ?? 3001}/api/portal`;
}

export function getQuotePortalUrl(token: string): string {
  return `${getPortalBase()}/quotes/${token}`;
}

export function getInvoicePortalUrl(token: string): string {
  return `${getPortalBase()}/invoices/${token}`;
}

const FROM = process.env.FROM_EMAIL ?? "noreply@resend.dev";

export async function sendQuoteEmail(opts: {
  to: string;
  customerName: string;
  quoteNumber: string;
  total: number;
  validUntil: string | null;
  token: string;
  businessName?: string;
  notes?: string | null;
}): Promise<{ sent: boolean; url: string }> {
  const url = getQuotePortalUrl(opts.token);
  const client = getResend();
  if (!client) return { sent: false, url };

  const businessName = opts.businessName ?? "Cloud POS";
  const html = quoteEmailHtml({ ...opts, url, businessName });

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Your Quote ${opts.quoteNumber} from ${businessName} — $${opts.total.toFixed(2)}`,
    html,
  });
  return { sent: true, url };
}

export async function sendInvoiceEmail(opts: {
  to: string;
  customerName: string;
  invoiceNumber: string;
  total: number;
  dueDate: string | null;
  token: string;
  businessName?: string;
  notes?: string | null;
}): Promise<{ sent: boolean; url: string }> {
  const url = getInvoicePortalUrl(opts.token);
  const client = getResend();
  if (!client) return { sent: false, url };

  const businessName = opts.businessName ?? "Cloud POS";
  const html = invoiceEmailHtml({ ...opts, url, businessName });

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Invoice ${opts.invoiceNumber} from ${businessName} — $${opts.total.toFixed(2)}`,
    html,
  });
  return { sent: true, url };
}

export async function sendOrderReceiptEmail(opts: {
  to: string;
  name: string;
  orderNumber: string;
  total: number;
  subtotal: number;
  tax: number;
  items: Array<{ productName: string; quantity: number; productPrice: number; subtotal: number }>;
  paymentMethod: string | null;
  entryMethod?: "contactless" | "chip" | "swipe" | "cash";
  transactionAt?: Date;
  businessName?: string;
}): Promise<boolean> {
  const client = getResend();
  if (!client) return false;

  const businessName = opts.businessName ?? "Cloud POS";
  const isCard = opts.paymentMethod === "card";
  const entryMethod = opts.entryMethod ?? (isCard ? "contactless" : "cash");
  const txDate = opts.transactionAt ?? new Date();

  const dateStr = txDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
  const timeStr = txDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

  const entryLabel =
    entryMethod === "contactless" ? "Contactless (Tap)" :
    entryMethod === "chip" ? "EMV Chip" :
    entryMethod === "swipe" ? "Magnetic Stripe" :
    "Cash";

  const authCode = isCard
    ? Math.random().toString(36).toUpperCase().replace(/[^A-Z0-9]/g, "").substring(0, 6).padEnd(6, "0")
    : "N/A";

  // AID for generic contactless
  const aid = isCard ? (entryMethod === "contactless" ? "A0000000031010" : "A0000000041010") : "";

  const itemRows = opts.items.map((it) => `
<tr>
  <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;vertical-align:top">
    <div style="color:#1e293b;font-size:14px;font-weight:600;margin-bottom:2px">${it.productName}</div>
    <div style="color:#94a3b8;font-size:12px">@ $${it.productPrice.toFixed(2)} each</div>
  </td>
  <td align="center" style="padding:10px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top;width:36px">
    <span style="color:#64748b;font-size:14px">${it.quantity}</span>
  </td>
  <td align="right" style="padding:10px 0;border-bottom:1px solid #f1f5f9;vertical-align:top;width:72px;white-space:nowrap">
    <span style="color:#1e293b;font-size:14px;font-weight:600">$${it.subtotal.toFixed(2)}</span>
  </td>
</tr>`).join("");

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
</head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:'Segoe UI',Helvetica,Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:32px 16px">

    <table width="540" cellpadding="0" cellspacing="0" style="max-width:540px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(12,32,116,.12)">

      <!-- ── Header ── -->
      <tr>
        <td style="background:linear-gradient(135deg,#0C2074 0%,#0057A8 60%,#0072C4 100%);padding:32px 40px 28px;text-align:center">
          <p style="margin:0 0 4px;color:rgba(255,255,255,.65);font-size:11px;letter-spacing:2px;text-transform:uppercase">Customer Receipt</p>
          <h1 style="margin:0 0 6px;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-.3px">${opts.orderNumber}</h1>
          <p style="margin:0;color:rgba(255,255,255,.75);font-size:13px">${dateStr} &nbsp;·&nbsp; ${timeStr}</p>
        </td>
      </tr>

      <!-- ── Greeting ── -->
      <tr>
        <td style="padding:28px 40px 0">
          <p style="margin:0 0 4px;color:#64748b;font-size:13px">Hi <strong style="color:#1e293b">${opts.name}</strong>,</p>
          <p style="margin:0;color:#64748b;font-size:13px;line-height:1.5">Thank you for your purchase at <strong style="color:#1e293b">${businessName}</strong>. Here is your receipt.</p>
        </td>
      </tr>

      <!-- ── Items ── -->
      <tr>
        <td style="padding:20px 40px 0">
          <table width="100%" cellpadding="0" cellspacing="0">
            <!-- Column header -->
            <tr>
              <td style="padding-bottom:8px;border-bottom:2px solid #e2e8f0;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Item</td>
              <td align="center" style="padding-bottom:8px;border-bottom:2px solid #e2e8f0;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;width:36px">Qty</td>
              <td align="right" style="padding-bottom:8px;border-bottom:2px solid #e2e8f0;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;width:72px">Amount</td>
            </tr>
            ${itemRows}
          </table>
        </td>
      </tr>

      <!-- ── Totals ── -->
      <tr>
        <td style="padding:16px 40px 0">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8faff;border-radius:12px;padding:16px 20px">
            <tr>
              <td style="color:#64748b;font-size:13px;padding-bottom:8px">Subtotal</td>
              <td align="right" style="color:#1e293b;font-size:13px;font-weight:600;padding-bottom:8px;white-space:nowrap">$&nbsp;${opts.subtotal.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="color:#64748b;font-size:13px;padding-bottom:12px;border-bottom:1px solid #e2e8f0">Sales Tax</td>
              <td align="right" style="color:#1e293b;font-size:13px;font-weight:600;padding-bottom:12px;border-bottom:1px solid #e2e8f0;white-space:nowrap">$&nbsp;${opts.tax.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="color:#0C2074;font-size:16px;font-weight:700;padding-top:12px">TOTAL</td>
              <td align="right" style="color:#0072C4;font-size:22px;font-weight:800;padding-top:12px;white-space:nowrap">$&nbsp;${opts.total.toFixed(2)}</td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ── EMV Payment Details ── -->
      <tr>
        <td style="padding:16px 40px 0">
          <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
            <tr>
              <td colspan="2" style="background:#f8faff;padding:10px 16px;border-bottom:1px solid #e2e8f0">
                <span style="color:#0C2074;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase">Payment Details</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 16px;color:#64748b;font-size:12px;border-bottom:1px solid #f1f5f9;width:50%">Method</td>
              <td align="right" style="padding:8px 16px;color:#1e293b;font-size:12px;font-weight:600;border-bottom:1px solid #f1f5f9">${entryLabel}</td>
            </tr>
            <tr>
              <td style="padding:8px 16px;color:#64748b;font-size:12px;border-bottom:1px solid #f1f5f9">Status</td>
              <td align="right" style="padding:8px 16px;border-bottom:1px solid #f1f5f9">
                <span style="display:inline-block;background:#dcfce7;color:#15803d;font-size:11px;font-weight:700;letter-spacing:.5px;padding:2px 8px;border-radius:20px">&#10003;&nbsp;APPROVED</span>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 16px;color:#64748b;font-size:12px;${isCard ? "border-bottom:1px solid #f1f5f9" : ""}">Auth Code</td>
              <td align="right" style="padding:8px 16px;color:#1e293b;font-size:12px;font-weight:700;letter-spacing:1px;font-family:monospace;${isCard ? "border-bottom:1px solid #f1f5f9" : ""}">${authCode}</td>
            </tr>
            ${isCard ? `
            <tr>
              <td style="padding:8px 16px;color:#64748b;font-size:12px;border-bottom:1px solid #f1f5f9">Entry Mode</td>
              <td align="right" style="padding:8px 16px;color:#1e293b;font-size:12px;font-weight:600;border-bottom:1px solid #f1f5f9">${entryLabel}</td>
            </tr>
            <tr>
              <td style="padding:8px 16px;color:#64748b;font-size:12px">AID</td>
              <td align="right" style="padding:8px 16px;color:#94a3b8;font-size:11px;font-family:monospace">${aid}</td>
            </tr>` : ""}
          </table>
        </td>
      </tr>

      <!-- ── No Signature Required note (contactless below floor limit) ── -->
      ${isCard && entryMethod === "contactless" ? `
      <tr>
        <td style="padding:12px 40px 0;text-align:center">
          <p style="margin:0;color:#94a3b8;font-size:11px;font-style:italic">No signature required — contactless transaction</p>
        </td>
      </tr>` : ""}

      <!-- ── Footer ── -->
      <tr>
        <td style="padding:24px 40px 28px;text-align:center;border-top:1px solid #f1f5f9;margin-top:20px">
          <p style="margin:0 0 4px;color:#94a3b8;font-size:11px">Thank you for your business!</p>
          <p style="margin:0;color:#cbd5e1;font-size:10px;letter-spacing:.5px">${businessName} &middot; Powered by Cloud POS</p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;

  await client.emails.send({
    from: FROM,
    to: opts.to,
    subject: `Your Receipt — ${opts.orderNumber} · $${opts.total.toFixed(2)} · ${businessName}`,
    html,
  });
  return true;
}

function quoteEmailHtml(o: {
  customerName: string;
  quoteNumber: string;
  total: number;
  validUntil: string | null;
  url: string;
  businessName: string;
  notes?: string | null;
}) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(12,32,116,.1)">
<tr><td style="background:linear-gradient(135deg,#0C2074,#0072C4);padding:32px 40px;text-align:center">
<p style="margin:0;color:rgba(255,255,255,.8);font-size:14px;letter-spacing:1px;text-transform:uppercase">Quote / Estimate</p>
<h1 style="margin:8px 0 0;color:#fff;font-size:28px">${o.quoteNumber}</h1>
</td></tr>
<tr><td style="padding:36px 40px">
<p style="margin:0 0 8px;color:#64748b;font-size:14px">Hi ${o.customerName},</p>
<p style="margin:0 0 28px;color:#1e293b;font-size:16px;line-height:1.6">${o.businessName} has sent you a quote for review. Please click the button below to view your quote and select which items you'd like to proceed with.</p>
<table cellpadding="0" cellspacing="0" style="background:#f8faff;border-radius:12px;width:100%;margin-bottom:28px"><tr>
<td style="padding:20px 24px"><table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="color:#64748b;font-size:13px">Total Amount</td><td align="right" style="color:#0072C4;font-size:22px;font-weight:700">$${o.total.toFixed(2)}</td></tr>
${o.validUntil ? `<tr><td style="color:#64748b;font-size:13px;padding-top:8px">Valid Until</td><td align="right" style="color:#1e293b;font-size:13px;padding-top:8px">${o.validUntil}</td></tr>` : ""}
</table></td></tr></table>
<table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:28px"><tr><td align="center">
<a href="${o.url}" style="display:inline-block;background:linear-gradient(135deg,#0C2074,#0072C4);color:#fff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 40px;border-radius:12px;letter-spacing:0.3px">Review & Accept Quote →</a>
</td></tr></table>
${o.notes ? `<p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.5;padding:16px;background:#f8faff;border-radius:10px;border-left:3px solid #0072C4">${o.notes}</p>` : ""}
<p style="margin:0;color:#94a3b8;font-size:12px">Or copy this link: <a href="${o.url}" style="color:#0072C4">${o.url}</a></p>
</td></tr>
<tr><td style="background:#f8faff;padding:20px 40px;text-align:center"><p style="margin:0;color:#94a3b8;font-size:12px">Sent by ${o.businessName} via Cloud POS</p></td></tr>
</table></td></tr></table></body></html>`;
}

function invoiceEmailHtml(o: {
  customerName: string;
  invoiceNumber: string;
  total: number;
  dueDate: string | null;
  url: string;
  businessName: string;
  notes?: string | null;
}) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f7fb;font-family:'Segoe UI',Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 20px">
<table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(12,32,116,.1)">
<tr><td style="background:linear-gradient(135deg,#0C2074,#0072C4);padding:32px 40px;text-align:center">
<p style="margin:0;color:rgba(255,255,255,.8);font-size:14px;letter-spacing:1px;text-transform:uppercase">Invoice</p>
<h1 style="margin:8px 0 0;color:#fff;font-size:28px">${o.invoiceNumber}</h1>
</td></tr>
<tr><td style="padding:36px 40px">
<p style="margin:0 0 8px;color:#64748b;font-size:14px">Hi ${o.customerName},</p>
<p style="margin:0 0 28px;color:#1e293b;font-size:16px;line-height:1.6">Please find your invoice from ${o.businessName} below. Click the button to view full details.</p>
<table cellpadding="0" cellspacing="0" style="background:#f8faff;border-radius:12px;width:100%;margin-bottom:28px"><tr>
<td style="padding:20px 24px"><table width="100%" cellpadding="0" cellspacing="0">
<tr><td style="color:#64748b;font-size:13px">Amount Due</td><td align="right" style="color:#0072C4;font-size:22px;font-weight:700">$${o.total.toFixed(2)}</td></tr>
${o.dueDate ? `<tr><td style="color:#64748b;font-size:13px;padding-top:8px">Due Date</td><td align="right" style="color:#dc2626;font-size:13px;font-weight:600;padding-top:8px">${o.dueDate}</td></tr>` : ""}
</table></td></tr></table>
<table cellpadding="0" cellspacing="0" style="width:100%;margin-bottom:28px"><tr><td align="center">
<a href="${o.url}" style="display:inline-block;background:linear-gradient(135deg,#0C2074,#0072C4);color:#fff;text-decoration:none;font-size:16px;font-weight:600;padding:16px 40px;border-radius:12px;letter-spacing:0.3px">View Invoice →</a>
</td></tr></table>
${o.notes ? `<p style="margin:0 0 20px;color:#64748b;font-size:14px;line-height:1.5;padding:16px;background:#f8faff;border-radius:10px;border-left:3px solid #0072C4">${o.notes}</p>` : ""}
<p style="margin:0;color:#94a3b8;font-size:12px">Or copy this link: <a href="${o.url}" style="color:#0072C4">${o.url}</a></p>
</td></tr>
<tr><td style="background:#f8faff;padding:20px 40px;text-align:center"><p style="margin:0;color:#94a3b8;font-size:12px">Sent by ${o.businessName} via Cloud POS</p></td></tr>
</table></td></tr></table></body></html>`;
}
