"use strict";
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "Cloud-POS-Mobile-Capabilities.pdf");

// ── Colour palette ─────────────────────────────────────────────────────────────
const NAVY      = "#0C2074";
const BLUE      = "#0072C4";
const LT_BLUE   = "#EFF6FF";
const WHITE     = "#FFFFFF";
const G50       = "#F9FAFB";
const G100      = "#F3F4F6";
const G200      = "#E5E7EB";
const G300      = "#D1D5DB";
const G400      = "#9CA3AF";
const G500      = "#6B7280";
const G700      = "#374151";
const G800      = "#1F2937";
const G900      = "#111827";
const SUCCESS   = "#16A34A";
const SUCC_BG   = "#F0FDF4";
const WARN      = "#D97706";
const WARN_BG   = "#FFFBEB";
const DANGER    = "#DC2626";
const DANG_BG   = "#FEF2F2";
const BRONZE    = "#B45309";
const SILVER    = "#6B7280";
const GOLD      = "#D97706";
const PLAT      = "#7C3AED";

// ── Document setup ─────────────────────────────────────────────────────────────
const doc = new PDFDocument({
  size: "LETTER",
  margins: { top: 0, bottom: 0, left: 0, right: 0 },
  info: {
    Title:   "Cloud POS Mobile — Product Capabilities Document",
    Author:  "wilcoxisaac",
    Subject: "Full Feature Reference · v2.0.0",
  },
});
const stream = fs.createWriteStream(OUT);
doc.pipe(stream);

const PW = 612;   // page width
const PH = 792;   // page height
const ML = 48;    // margin left
const MR = 48;    // margin right
const CW = PW - ML - MR;   // content width = 516

let pageNum = 0;

// ── Safe-y tracking ────────────────────────────────────────────────────────────
// Adds a new page if fewer than `needed` vertical points remain above the bottom margin.
function need(needed) {
  const safe = PH - 64;
  if (doc.y + needed > safe) {
    addPage();
    return true;
  }
  return false;
}

// ── Page primitives ────────────────────────────────────────────────────────────
function addPage() {
  doc.addPage();
  pageNum++;
}

// Coloured header bar used on every content page
function pageHeader(title, sub) {
  doc.rect(0, 0, PW, 100).fill(NAVY);
  doc.rect(0, 95, PW, 5).fill(BLUE);
  doc
    .fillColor(WHITE).font("Helvetica-Bold").fontSize(22)
    .text(title, ML, 22, { width: CW - 60, lineBreak: false });
  if (sub) {
    doc
      .fillColor("rgba(255,255,255,0.65)").font("Helvetica").fontSize(9.5)
      .text(sub, ML, 52, { width: CW });
  }
  doc
    .fillColor("rgba(255,255,255,0.45)").font("Helvetica").fontSize(8)
    .text(`Page ${pageNum}`, PW - MR - 36, 80, { width: 36, align: "right" });
  doc.y = 116;
}

// Section title with left accent bar
function secTitle(text) {
  need(28);
  const y = doc.y + 4;
  doc.rect(ML, y, 3, 16).fill(BLUE);
  doc.fillColor(G800).font("Helvetica-Bold").fontSize(12).text(text, ML + 10, y + 1, { width: CW });
  doc.y = y + 22;
}

// Sub-heading
function subHead(text) {
  need(16);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10).text(text, ML, doc.y + 4, { width: CW });
  doc.y += 16;
}

// Body paragraph
function para(text, indent) {
  const x = ML + (indent || 0);
  const w = CW - (indent || 0);
  const h = doc.heightOfString(text, { width: w, fontSize: 9 }) + 4;
  need(h);
  doc.fillColor(G500).font("Helvetica").fontSize(9).text(text, x, doc.y, { width: w });
  doc.y += 4;
}

// Bullet point
function bullet(text, col) {
  const h = doc.heightOfString(text, { width: CW - 20, fontSize: 9 }) + 4;
  need(h);
  const y = doc.y;
  doc.circle(ML + 7, y + 5.5, 2.5).fill(col || BLUE);
  doc.fillColor(G500).font("Helvetica").fontSize(9).text(text, ML + 16, y, { width: CW - 16 });
  doc.y += 3;
}

function sp(h) { doc.y += (h || 10); }

function rule() {
  need(14);
  doc.moveTo(ML, doc.y + 4).lineTo(PW - MR, doc.y + 4)
    .strokeColor(G200).lineWidth(0.5).stroke();
  doc.y += 12;
}

// KPI stat box
function kpi(x, y, w, h, value, label, valColor) {
  doc.rect(x, y, w, h).fill(LT_BLUE);
  doc.rect(x, y, w, 3).fill(BLUE);
  doc.fillColor(valColor || NAVY).font("Helvetica-Bold").fontSize(15)
    .text(value, x, y + 12, { width: w, align: "center" });
  doc.fillColor(G400).font("Helvetica").fontSize(7.5)
    .text(label, x, y + 32, { width: w, align: "center" });
}

// Table header row
function tHead(cols, y) {
  const rowH = 20;
  doc.rect(ML, y, CW, rowH).fill(NAVY);
  let x = ML;
  cols.forEach(c => {
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(7.5)
      .text(c.label, x + 5, y + 6, { width: c.w - 10, align: c.align || "left" });
    x += c.w;
  });
  return y + rowH;
}

// Table data row
function tRow(cols, vals, y, shade) {
  const rowH = 18;
  if (shade) doc.rect(ML, y, CW, rowH).fill(G50);
  doc.rect(ML, y + rowH - 0.5, CW, 0.5).fill(G200);
  let x = ML;
  cols.forEach((c, i) => {
    const v = vals[i] || "";
    let color = G700;
    if (v === "✓")        color = SUCCESS;
    else if (v === "—")   color = G400;
    else if (v === "Critical") color = DANGER;
    else if (v === "Low")  color = WARN;
    else if (v === "OK")   color = SUCCESS;
    const bold = v === "✓" || v === "—";
    doc.fillColor(color).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8)
      .text(v, x + 5, y + 4.5, { width: c.w - 10, align: c.align || "left" });
    x += c.w;
  });
  return y + rowH;
}

// Badge pill
function badge(x, y, text, color, bg) {
  const tw = Math.min(doc.widthOfString(text, { fontSize: 7.5 }) + 16, 120);
  doc.rect(x, y - 1, tw, 13).fill(bg);
  doc.fillColor(color).font("Helvetica-Bold").fontSize(7)
    .text(text, x + 4, y + 2, { width: tw - 8, align: "center" });
  return x + tw + 6;
}

// Tier badge
function tierBadge(x, y, tier) {
  const M = {
    Bronze:   { icon: "🥉", c: BRONZE,  bg: "#FEF3C7" },
    Silver:   { icon: "🥈", c: SILVER,  bg: G100 },
    Gold:     { icon: "🥇", c: GOLD,    bg: WARN_BG },
    Platinum: { icon: "💎", c: PLAT,    bg: "#EDE9FE" },
  }[tier] || { icon: "●", c: G500, bg: G100 };
  return badge(x, y, `${M.icon} ${tier}`, M.c, M.bg);
}

// ── iPhone frame + screen content ─────────────────────────────────────────────
/*
  drawPhone(x, y, opts)
  opts.screen: function(sx, sy, sw, sh) — called to draw content inside the screen
  opts.caption: string shown below the phone
*/
function drawPhone(x, y, opts) {
  const fw = opts.w || 130;
  const fh = opts.h || 260;
  const br = 22;
  const bevel = 2.5;

  // Outer shell — dark titanium
  doc.roundedRect(x, y, fw, fh, br).fill("#2A2A2E").stroke("#1A1A1C");
  // Inner bezel
  doc.roundedRect(x + bevel, y + bevel, fw - bevel * 2, fh - bevel * 2, br - 1)
    .fill("#1C1C1E").stroke("#0D0D0E");
  // Screen area
  const sx = x + 6, sy = y + 10, sw = fw - 12, sh = fh - 20;
  doc.roundedRect(sx, sy, sw, sh, 16).fill("#0A0A14");

  // Dynamic island
  const diW = fw * 0.28, diH = 10, diX = x + fw / 2 - diW / 2, diY = y + 14;
  doc.roundedRect(diX, diY, diW, diH, diH / 2).fill("#000000");

  // Status bar
  const sbY = sy + 4;
  doc.fillColor("rgba(255,255,255,0.7)").font("Helvetica-Bold").fontSize(5.5)
    .text("9:41", sx + 6, sbY, { width: 24 });
  // Signal dots
  [0, 5, 10].forEach((dx, i) => {
    doc.roundedRect(sx + sw - 34 + dx * 3.5, sbY + 2, 2.5, 4 + i * 1.5, 0.5)
      .fill("rgba(255,255,255,0.7)");
  });
  // Battery
  doc.rect(sx + sw - 20, sbY + 1, 14, 7).stroke("rgba(255,255,255,0.5)").lineWidth(0.5);
  doc.rect(sx + sw - 19, sbY + 2, 11, 5).fill("rgba(255,255,255,0.7)");
  doc.rect(sx + sw - 6, sbY + 3, 2, 3).fill("rgba(255,255,255,0.5)");

  // Content area for drawing
  const contentY = sy + 18;
  const contentH = sh - 30;

  // Call the screen painter
  if (opts.screen) {
    // clip to screen
    doc.save();
    doc.rect(sx, sy, sw, sh).clip();
    opts.screen(sx, contentY, sw, contentH);
    doc.restore();
  }

  // Home indicator
  doc.roundedRect(x + fw / 2 - 18, y + fh - 8, 36, 4, 2).fill("rgba(255,255,255,0.25)");

  // Side buttons
  doc.rect(x - 2, y + fh * 0.25, 3, 22).roundedRect(x - 2, y + fh * 0.25, 3, 22, 1.5).fill("#3A3A3C");
  doc.rect(x + fw - 1, y + fh * 0.30, 3, 30).roundedRect(x + fw - 1, y + fh * 0.30, 3, 30, 1.5).fill("#3A3A3C");

  // Caption
  if (opts.caption) {
    doc.fillColor(G500).font("Helvetica").fontSize(7.5)
      .text(opts.caption, x, y + fh + 6, { width: fw, align: "center" });
  }
  return { sx, sy, sw, sh, contentY, contentH };
}

// ── Screen painters ────────────────────────────────────────────────────────────
function screenOrders(sx, cy, sw) {
  // Tab bar
  doc.rect(sx, cy - 6, sw, 18).fill("#111827");
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text("Cloud POS", sx, cy - 2, { width: sw, align: "center" });
  // Alert banner
  doc.rect(sx, cy + 14, sw, 16).fill(DANG_BG);
  doc.rect(sx, cy + 14, 3, 16).fill(DANGER);
  doc.fillColor(DANGER).font("Helvetica-Bold").fontSize(5).text("Stale order: #ORD-2087", sx + 6, cy + 18);
  // KPI strip
  const kw = sw / 2 - 2;
  [[  "$1,842", "Revenue"], ["43", "Orders"]].forEach((k, i) => {
    doc.rect(sx + i * (kw + 2), cy + 32, kw, 22).fill(LT_BLUE);
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8).text(k[0], sx + i * (kw + 2), cy + 34, { width: kw, align: "center" });
    doc.fillColor(G400).font("Helvetica").fontSize(4.5).text(k[1], sx + i * (kw + 2), cy + 43, { width: kw, align: "center" });
  });
  // Order cards
  const cards = ["#ORD-2091  T7  $68.50", "#ORD-2090  T3  $41.75", "#ORD-2089  Walk-in  $28.00"];
  cards.forEach((c, i) => {
    const cy2 = cy + 58 + i * 22;
    doc.rect(sx, cy2, sw, 20).fill(i % 2 === 0 ? "#0D1526" : "#111827");
    doc.rect(sx, cy2, 3, 20).fill(BLUE);
    doc.fillColor(WHITE).font("Helvetica").fontSize(5).text(c, sx + 6, cy2 + 7);
    doc.fillColor(SUCCESS).font("Helvetica-Bold").fontSize(5).text("OPEN", sx + sw - 22, cy2 + 7);
  });
  // Bottom tab bar
  const navY = cy + 126;
  doc.rect(sx, navY, sw, 20).fill(G900);
  const tabs = ["Orders","Tables","Kitchen","Menu","More"];
  tabs.forEach((t, i) => {
    const tx = sx + i * (sw / tabs.length);
    const tw2 = sw / tabs.length;
    doc.fillColor(i === 0 ? BLUE : G400).font("Helvetica").fontSize(4).text(t, tx, navY + 8, { width: tw2, align: "center" });
  });
}

function screenCheckout(sx, cy, sw) {
  doc.rect(sx, cy - 6, sw, 18).fill("#111827");
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text("Checkout", sx, cy - 2, { width: sw, align: "center" });
  // Amount
  doc.rect(sx, cy + 14, sw, 28).fill(NAVY);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(14).text("$68.50", sx, cy + 18, { width: sw, align: "center" });
  doc.fillColor("rgba(255,255,255,0.5)").font("Helvetica").fontSize(4.5).text("Order #ORD-2091 · Table 7", sx, cy + 36, { width: sw, align: "center" });
  // Payment methods
  ["💳  Card (Tap to Pay)", "💵  Cash"].forEach((m, i) => {
    const my = cy + 46 + i * 20;
    doc.rect(sx + 4, my, sw - 8, 18).fill(i === 0 ? BLUE : "#1E293B");
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text(m, sx + 4, my + 6, { width: sw - 8, align: "center" });
  });
  // NFC indicator
  doc.rect(sx + 4, cy + 88, sw - 8, 28).fill("#050D1A");
  doc.circle(sx + sw / 2, cy + 102, 12).fill("rgba(0,114,196,0.2)");
  [7, 12, 17].forEach(r => {
    doc.circle(sx + sw / 2, cy + 102, r).stroke(BLUE).lineWidth(0.5).opacity(0.5);
  });
  doc.opacity(1);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(4.5).text("Hold card to top of iPhone", sx, cy + 118, { width: sw, align: "center" });
  // Charge button
  doc.rect(sx + 4, cy + 126, sw - 8, 16).fill(SUCCESS);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(7).text("CHARGE  $68.50", sx + 4, cy + 130, { width: sw - 8, align: "center" });
}

function screenCustomers(sx, cy, sw) {
  doc.rect(sx, cy - 6, sw, 18).fill("#111827");
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text("Customers", sx, cy - 2, { width: sw, align: "center" });
  // Tier filter pills
  const pills = [{ l: "All", c: NAVY, tc: WHITE }, { l: "💎 Plat", c: "#EDE9FE", tc: PLAT }, { l: "🥇 Gold", c: WARN_BG, tc: GOLD }];
  pills.forEach((p, i) => {
    doc.rect(sx + 2 + i * 38, cy + 14, 34, 10).fill(p.c);
    doc.fillColor(p.tc).font("Helvetica-Bold").fontSize(4.5).text(p.l, sx + 2 + i * 38, cy + 17, { width: 34, align: "center" });
  });
  // Customer rows
  const custs = [
    { n: "Emily Chen",    tier: "💎", pts: "5200", c: PLAT },
    { n: "Jennifer Park", tier: "🥇", pts: "3100", c: GOLD },
    { n: "Sarah Johnson", tier: "🥇", pts: "2450", c: GOLD },
    { n: "Marcus Williams",tier:"🥈",pts: "890",  c: SILVER },
    { n: "Robert Garcia", tier: "🥉", pts: "150",  c: BRONZE },
  ];
  custs.forEach((cu, i) => {
    const ry = cy + 28 + i * 20;
    doc.rect(sx, ry, sw, 19).fill(i % 2 === 0 ? "#0D1526" : "#111827");
    doc.fillColor(cu.c).font("Helvetica-Bold").fontSize(5.5).text(cu.tier, sx + 4, ry + 7);
    doc.fillColor(WHITE).font("Helvetica").fontSize(5).text(cu.n, sx + 14, ry + 7, { width: sw - 40 });
    doc.fillColor(cu.c).font("Helvetica-Bold").fontSize(5).text(cu.pts + "pts", sx + sw - 26, ry + 7);
  });
  // Sync button
  doc.rect(sx + 4, cy + 130, sw - 8, 14).fill(BLUE);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(5.5).text("⟳  Sync with Cloud POS", sx + 4, cy + 134, { width: sw - 8, align: "center" });
}

function screenKitchen(sx, cy, sw) {
  doc.rect(sx, cy - 6, sw, 18).fill("#111827");
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text("Kitchen Display", sx, cy - 2, { width: sw, align: "center" });
  // Tickets
  const tickets = [
    { num: "#ORD-2091", table: "T7 · 3 guests", time: "8m", s: "NEW",  sc: DANGER,  sb: DANG_BG,   bc: "#EF4444",
      items: ["2× Burger (no onion)", "1× Caesar Salad", "2× Craft Beer"] },
    { num: "#ORD-2090", table: "T3 · 2 guests", time: "4m", s: "PREP", sc: WARN,    sb: WARN_BG,   bc: "#F59E0B",
      items: ["1× Margherita Pizza", "1× Tiramisu"] },
  ];
  tickets.forEach((t, ti) => {
    const ty = cy + 14 + ti * 72;
    doc.rect(sx, ty, sw, 68).fill(t.sb);
    doc.rect(sx, ty, 4, 68).fill(t.bc);
    doc.fillColor(t.sc).font("Helvetica-Bold").fontSize(6).text(t.num, sx + 8, ty + 5);
    doc.fillColor(G500).font("Helvetica").fontSize(5).text(t.table, sx + 8, ty + 13);
    doc.rect(sx + sw - 28, ty + 4, 24, 10).fill(t.sc + "30");
    doc.fillColor(t.sc).font("Helvetica-Bold").fontSize(5).text("⏱ " + t.time, sx + sw - 28, ty + 7, { width: 24, align: "center" });
    t.items.forEach((item, ii) => {
      doc.fillColor(G700).font("Helvetica").fontSize(5).text(item, sx + 8, ty + 22 + ii * 10);
    });
    // Action button
    doc.rect(sx + 4, ty + 56, sw - 8, 10).fill(t.sc);
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(4.5)
      .text(ti === 0 ? "→  START PREPARING" : "→  MARK READY", sx + 4, ty + 59, { width: sw - 8, align: "center" });
  });
}

function screenTables(sx, cy, sw) {
  doc.rect(sx, cy - 6, sw, 18).fill("#111827");
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text("Table Management", sx, cy - 2, { width: sw, align: "center" });
  const tables = [
    { n: "T1", s: "Available", c: SUCCESS,  bg: SUCC_BG },
    { n: "T2", s: "Occupied",  c: WARN,     bg: WARN_BG,  sub: "34m · $87" },
    { n: "T3", s: "Occupied",  c: WARN,     bg: WARN_BG,  sub: "12m · $42" },
    { n: "T4", s: "Reserved",  c: BLUE,     bg: LT_BLUE  },
    { n: "T5", s: "Available", c: SUCCESS,  bg: SUCC_BG },
    { n: "T6", s: "Cleaning",  c: DANGER,   bg: DANG_BG  },
  ];
  const cols = 3, tw = (sw - 4) / cols, th = 36;
  tables.forEach((t, i) => {
    const tx = sx + (i % cols) * tw + 1;
    const ty = cy + 14 + Math.floor(i / cols) * (th + 3);
    doc.rect(tx, ty, tw - 1, th).fill(t.bg);
    doc.rect(tx, ty, tw - 1, 2.5).fill(t.c);
    doc.fillColor(t.c).font("Helvetica-Bold").fontSize(9).text(t.n, tx, ty + 5, { width: tw - 1, align: "center" });
    doc.fillColor(t.c).font("Helvetica").fontSize(4.5).text(t.s, tx, ty + 17, { width: tw - 1, align: "center" });
    if (t.sub) doc.fillColor(G500).fontSize(4).text(t.sub, tx, ty + 26, { width: tw - 1, align: "center" });
  });
  // Reservation list stub
  const rY = cy + 92;
  doc.rect(sx, rY, sw, 14).fill(NAVY);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(5).text("Upcoming Reservations", sx + 4, rY + 5);
  doc.rect(sx, rY + 14, sw, 12).fill("#0D1526");
  doc.fillColor(G400).font("Helvetica").fontSize(4.5).text("Thompson Party · 7:00 PM · T4 · Confirmed", sx + 4, rY + 17);
  doc.rect(sx, rY + 26, sw, 12).fill("#111827");
  doc.fillColor(G400).font("Helvetica").fontSize(4.5).text("Chen, Emily · 7:30 PM · T1 · Pending", sx + 4, rY + 29);
}

function screenInvoices(sx, cy, sw) {
  doc.rect(sx, cy - 6, sw, 18).fill("#111827");
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text("Invoices & Quotes", sx, cy - 2, { width: sw, align: "center" });
  // Tabs
  ["Invoices", "Quotes"].forEach((t, i) => {
    doc.rect(sx + i * (sw / 2), cy + 14, sw / 2, 12).fill(i === 0 ? NAVY : "#1E293B");
    doc.fillColor(i === 0 ? WHITE : G500).font("Helvetica-Bold").fontSize(5).text(t, sx + i * (sw / 2), cy + 18, { width: sw / 2, align: "center" });
  });
  const docs2 = [
    { n: "#INV-0042", who: "Emily Chen",    amt: "$200.00", s: "PAID",    sc: SUCCESS, sb: SUCC_BG },
    { n: "#INV-0041", who: "Jennifer Park", amt: "$85.00",  s: "UNPAID",  sc: WARN,    sb: WARN_BG },
    { n: "#INV-0040", who: "Marcus Williams",amt:"$450.00", s: "OVERDUE", sc: DANGER,  sb: DANG_BG },
  ];
  docs2.forEach((d, i) => {
    const dy = cy + 30 + i * 26;
    doc.rect(sx, dy, sw, 24).fill(i % 2 === 0 ? "#0D1526" : "#111827");
    doc.rect(sx, dy, 3, 24).fill(d.sc);
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(5.5).text(d.n, sx + 6, dy + 4);
    doc.fillColor(G500).font("Helvetica").fontSize(4.5).text(d.who, sx + 6, dy + 12);
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(7).text(d.amt, sx + sw - 40, dy + 4);
    doc.rect(sx + sw - 38, dy + 14, 34, 8).fill(d.sb);
    doc.fillColor(d.sc).font("Helvetica-Bold").fontSize(4).text(d.s, sx + sw - 38, dy + 16.5, { width: 34, align: "center" });
  });
  // + New button
  doc.rect(sx + 4, cy + 112, sw - 8, 14).fill(BLUE);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text("+  New Invoice", sx + 4, cy + 116, { width: sw - 8, align: "center" });
  doc.rect(sx + 4, cy + 128, sw - 8, 14).fill("#1E3A8A");
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text("+  New Quote", sx + 4, cy + 132, { width: sw - 8, align: "center" });
}

function screenSettings(sx, cy, sw) {
  doc.rect(sx, cy - 6, sw, 18).fill("#111827");
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text("Settings", sx, cy - 2, { width: sw, align: "center" });
  const rows = [
    { icon: "⚙️", label: "Industry Mode", val: "Restaurant" },
    { icon: "💳", label: "Payment Terms", val: "Net 7" },
    { icon: "🏷️", label: "Tax Rate",      val: "8.875%" },
    { icon: "📱", label: "App Version",    val: "2.0.0" },
    { icon: "🏢", label: "Back Office",    val: "Open ›" },
    { icon: "🌙", label: "Dark Mode",      val: "System" },
  ];
  rows.forEach((r, i) => {
    const ry = cy + 14 + i * 20;
    doc.rect(sx, ry, sw, 19).fill(i % 2 === 0 ? "#0D1526" : "#111827");
    doc.rect(sx, ry + 18.5, sw, 0.5).fill(G900);
    doc.font("Helvetica").fontSize(6).fillColor(WHITE).text(r.icon, sx + 5, ry + 6);
    doc.font("Helvetica").fontSize(5.5).fillColor(G400).text(r.label, sx + 18, ry + 7);
    doc.font("Helvetica-Bold").fontSize(5.5).fillColor(BLUE).text(r.val, sx + sw - 35, ry + 7, { width: 32, align: "right" });
    doc.font("Helvetica").fontSize(6).fillColor(G500).text("›", sx + sw - 8, ry + 6);
  });
}

function screenAppointments(sx, cy, sw) {
  doc.rect(sx, cy - 6, sw, 18).fill("#111827");
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text("Appointments", sx, cy - 2, { width: sw, align: "center" });
  // Mini calendar
  doc.rect(sx, cy + 14, sw, 50).fill("#0D1526");
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text("March 2026", sx, cy + 17, { width: sw, align: "center" });
  const days = ["Su","Mo","Tu","We","Th","Fr","Sa"];
  days.forEach((d, i) => {
    doc.fillColor(G500).font("Helvetica").fontSize(4.5).text(d, sx + 2 + i * (sw / 7), cy + 26, { width: sw / 7, align: "center" });
  });
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 7; col++) {
      const dayNum = row * 7 + col - 1;
      if (dayNum < 1 || dayNum > 31) continue;
      const dx = sx + 2 + col * (sw / 7);
      const dy = cy + 32 + row * 8;
      const isToday = dayNum === 21;
      const hasAppt = [3, 8, 12, 15, 18, 21, 22, 25].includes(dayNum);
      if (isToday) doc.circle(dx + sw / 14, dy + 3, 5).fill(BLUE);
      doc.fillColor(isToday ? WHITE : G400).font("Helvetica").fontSize(4.5)
        .text(String(dayNum), dx, dy, { width: sw / 7, align: "center" });
      if (hasAppt && !isToday) doc.circle(dx + sw / 14, dy + 6.5, 1.2).fill(BLUE);
    }
  }
  // Appointment list
  const appts = [
    { time: "9:00 AM", name: "Sarah Johnson", svc: "Color Treatment", s: "In Progress", sc: SUCCESS },
    { time: "10:30 AM", name: "Emily Chen",   svc: "Facial",          s: "Confirmed",  sc: BLUE },
    { time: "11:00 AM", name: "M. Williams",  svc: "Haircut",         s: "Pending",    sc: G500 },
  ];
  appts.forEach((a, i) => {
    const ay = cy + 68 + i * 22;
    doc.rect(sx, ay, sw, 20).fill(i % 2 === 0 ? "#0D1526" : "#111827");
    doc.rect(sx, ay, 3, 20).fill(a.sc);
    doc.fillColor(G400).font("Helvetica").fontSize(4.5).text(a.time, sx + 6, ay + 4);
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(5).text(a.name, sx + 6, ay + 11);
    doc.fillColor(G500).font("Helvetica").fontSize(4.5).text(a.svc, sx + 6, ay + 11);
    doc.rect(sx + sw - 34, ay + 5, 30, 9).fill(a.sc + "25");
    doc.fillColor(a.sc).font("Helvetica-Bold").fontSize(4).text(a.s, sx + sw - 34, ay + 8, { width: 30, align: "center" });
  });
}

// ── COVER PAGE ──────────────────────────────────────────────────────────────────
pageNum = 1;

// Full dark gradient background
doc.rect(0, 0, PW, PH).fill(NAVY);
doc.rect(0, 0, PW, PH / 2).fill("#0A1628");

// Radial glow behind phones (simulated with concentric circles)
[140, 110, 80, 50].forEach(r => {
  doc.circle(PW / 2, 390, r * 2.5)
    .fill(`rgba(0,114,196,${(0.05 * (140 / r)).toFixed(2)})`);
});

// Logo mark
const logoX = PW / 2 - 28, logoY = 34;
doc.circle(logoX + 28, logoY + 28, 28).fill(BLUE);
doc.circle(logoX + 28, logoY + 28, 18).fill(NAVY);
doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(14).text("POS", logoX + 8, logoY + 20);

// Title
doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(30)
  .text("Cloud POS Mobile", ML, 100, { width: CW, align: "center" });
doc.fillColor("rgba(255,255,255,0.65)").font("Helvetica").fontSize(13)
  .text("Product Capabilities Document", ML, 138, { width: CW, align: "center" });

// Rule
doc.moveTo(ML + 70, 162).lineTo(PW - MR - 70, 162).strokeColor(BLUE).lineWidth(1.5).stroke();

doc.fillColor("rgba(255,255,255,0.5)").font("Helvetica").fontSize(10)
  .text("Next-Generation Mobile Point-of-Sale  ·  iOS & Android  ·  v2.0.0", ML, 172, { width: CW, align: "center" });

// ── 4 phone mockups on the cover ──────────────────────────────────────────────
const phoneW = 112, phoneH = 226;
const phoneGap = (CW - 4 * phoneW) / 5;
const phoneY = 210;

const coverPhones = [
  { caption: "Orders",      fn: screenOrders },
  { caption: "Checkout",    fn: screenCheckout },
  { caption: "Customers",   fn: screenCustomers },
  { caption: "Kitchen KDS", fn: screenKitchen },
];
coverPhones.forEach((p, i) => {
  const px = ML + phoneGap + i * (phoneW + phoneGap);
  drawPhone(px, phoneY, {
    w: phoneW, h: phoneH,
    caption: p.caption,
    screen: (sx, cy, sw) => p.fn(sx, cy, sw),
  });
});

// Stat badges
const statY = 470;
const statData = [
  { v: "14+",        l: "Feature Modules" },
  { v: "4 Tiers",   l: "Loyalty Program" },
  { v: "3 Modes",   l: "Restaurant · Retail · Service" },
  { v: "iOS + Android", l: "Cross-Platform Native" },
];
const sw2 = (CW - 18) / 4;
statData.forEach((s, i) => {
  const bx = ML + i * (sw2 + 6);
  doc.rect(bx, statY, sw2, 56).fill("rgba(255,255,255,0.07)");
  doc.rect(bx, statY, sw2, 3).fill(BLUE);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(14).text(s.v, bx, statY + 10, { width: sw2, align: "center" });
  doc.fillColor("rgba(255,255,255,0.5)").font("Helvetica").fontSize(7.5).text(s.l, bx, statY + 34, { width: sw2, align: "center" });
});

// URL row
const urlY = 546;
doc.rect(ML, urlY, CW, 34).fill("rgba(255,255,255,0.06)");
doc.rect(ML, urlY, CW, 2).fill(BLUE);
doc.fillColor("rgba(255,255,255,0.4)").font("Helvetica").fontSize(7.5).text("BACK OFFICE", ML + 14, urlY + 8);
doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(9).text("https://cloud-po-s-wilcoxisaac.replit.app", ML + 14, urlY + 20);
doc.fillColor("rgba(255,255,255,0.4)").font("Helvetica").fontSize(7.5).text("MOBILE APP  ·  Scan QR in Expo Go — iOS & Android", PW / 2 + 14, urlY + 8);
doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(9).text("EAS Build: npx eas-cli build -p ios --profile production", PW / 2 + 14, urlY + 20);

// Second row of 3 phones
const phone2Y = 598;
const phone2W = 110, phone2H = 200;
const phone2Gap = (CW - 3 * phone2W) / 4;
const coverPhones2 = [
  { caption: "Table Management", fn: screenTables },
  { caption: "Appointments",     fn: screenAppointments },
  { caption: "Invoices & Quotes", fn: screenInvoices },
];
coverPhones2.forEach((p, i) => {
  const px = ML + phone2Gap + i * (phone2W + phone2Gap);
  drawPhone(px, phone2Y, {
    w: phone2W, h: phone2H,
    caption: p.caption,
    screen: (sx, cy, sw) => p.fn(sx, cy, sw),
  });
});

// Footer
doc.rect(0, PH - 40, PW, 40).fill("#050A14");
doc.fillColor("rgba(255,255,255,0.35)").font("Helvetica").fontSize(8)
  .text("Built by wilcoxisaac on Replit  ·  March 2026  ·  Cloud POS Mobile v2.0.0  ·  Elavon Payments  ·  React Native / Expo", ML, PH - 26, { width: CW, align: "center" });

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 2  — TABLE OF CONTENTS
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("Table of Contents", "Cloud POS Mobile — Product Capabilities Document");

const toc = [
  ["1", "Executive Summary",                                             3],
  ["2", "System Architecture & Data Flow",                               4],
  ["3", "Industry Modes — Restaurant, Retail & Service",                 5],
  ["4.1", "Orders & Live Dashboard",                                     6],
  ["4.2", "New Order Flow & Cart Builder",                               7],
  ["4.3", "Checkout & Payments  (NFC Tap to Pay · Cash · Card)",         8],
  ["4.4", "Table Management & Reservations",                             9],
  ["4.5", "Kitchen Display System (KDS)",                               10],
  ["4.6", "Appointments  (Service Mode)",                               11],
  ["4.7", "Quotes & Invoices",                                          12],
  ["4.8", "Customer CRM & Loyalty Program",                             13],
  ["4.9", "Menu / Product Catalog Management",                          14],
  ["4.10","Order History",                                              15],
  ["4.11","Back Office (Cloud-PoS Integration)",                        16],
  ["4.12","Settings & Configuration",                                   17],
  ["5",  "Feature Comparison Matrix",                                   18],
  ["6",  "Technical Architecture & Integration Reference",              19],
];

sp(4);
toc.forEach(([n, title, pg], i) => {
  const y = doc.y;
  if (i % 2 === 0) doc.rect(ML, y - 1, CW, 17).fill(G50);
  doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(9).text(n, ML + 4, y + 3, { width: 22 });
  doc.fillColor(G700).font("Helvetica").fontSize(9).text(title, ML + 28, y + 3, { width: CW - 70 });
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text(`${pg}`, PW - MR - 20, y + 3, { width: 18, align: "right" });
  doc.y = y + 16;
});

sp(16);
// Quick-launch box
const launchY = doc.y;
doc.rect(ML, launchY, CW, 54).fill(LT_BLUE);
doc.rect(ML, launchY, 4, 54).fill(BLUE);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10).text("How to Launch  Cloud POS Mobile", ML + 14, launchY + 8, { width: CW - 18 });
doc.fillColor(G500).font("Helvetica").fontSize(9)
  .text("1.  Open the Camera app (iOS) or Expo Go app (iOS / Android)\n2.  Scan the QR code at the mobile launch page — app loads instantly, no App Store install required\n3.  For a signed native build with full NFC Tap to Pay support, build via EAS: npx eas-cli build -p ios --profile production",
        ML + 14, launchY + 24, { width: CW - 18 });
doc.y = launchY + 60;

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 3  — EXECUTIVE SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("1. Executive Summary", "Cloud POS Mobile — Next-Generation Point-of-Sale Platform");

para("Cloud POS Mobile is a cross-platform Expo (React Native) mobile application delivering native iOS and Android performance for tableside ordering, mobile checkout, customer management, and real-time business operations. It is the mobile companion to the Cloud-PoS web back-office, sharing a live PostgreSQL database and REST API layer.");

sp(8);
secTitle("Core Value Propositions");
sp(4);

const props = [
  ["NFC Tap to Pay on iPhone", "Customers tap their contactless card, Apple Pay, or Apple Watch directly on the iPhone — no external card reader required. Uses iOS NFC Tag APDU entitlement (com.apple.developer.nfc.readersession.formats: TAG)."],
  ["Real-Time Cloud Sync", "All orders, kitchen tickets, inventory, and customer records sync instantly between the mobile app and the Cloud-PoS web back-office through a shared PostgreSQL database."],
  ["Multi-Industry Platform", "Three fully distinct operating modes — Restaurant, Retail, and Service — each with tailored navigation, screens, and workflows. Switch modes in Settings to instantly reconfigure the entire app."],
  ["4-Tier Loyalty Program", "Built-in Bronze → Silver → Gold → Platinum loyalty system. Points accumulate automatically with every transaction. Tier badges display on customer profiles and sync with Cloud-PoS."],
  ["Quotes & Invoices", "Full document workflow for service and retail — create estimates, convert to invoices, email payment portal links, and track paid/overdue status with configurable Net payment terms."],
  ["Kitchen Display System", "Live kitchen ticket queue (New → Preparing → Ready → Served) with elapsed timers, guest counts, and item-level modifier notes — purpose-built for back-of-house staff."],
  ["Appointment Scheduling", "Full calendar booking for service businesses — staff assignment, duration tracking, and status lifecycle management (Pending → Confirmed → In-Progress → Completed)."],
  ["Elavon / Converge Payments", "Native Elavon integration for credit card, debit, and cash transactions. Configurable tax rate, cash change calculation, and per-transaction payment receipt."],
];

props.forEach(([title, desc]) => {
  need(36);
  const y = doc.y;
  doc.rect(ML, y, 3, 32).fill(BLUE);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9.5).text(title, ML + 10, y + 2, { width: CW - 10 });
  doc.fillColor(G500).font("Helvetica").fontSize(8.5).text(desc, ML + 10, y + 14, { width: CW - 10 });
  doc.y = y + 38;
});

sp(10);
const kRow = doc.y;
const kw = (CW - 18) / 4;
[["iOS + Android", "Native Platforms"], ["14+", "Feature Modules"], ["4 Tiers", "Loyalty Program"], ["3 Modes", "Business Types"]].forEach((k, i) => {
  kpi(ML + i * (kw + 6), kRow, kw, 50, k[0], k[1]);
});
doc.y = kRow + 58;

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 4  — ARCHITECTURE
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("2. System Architecture & Data Flow", "Shared API, PostgreSQL database, and cloud hosting on Replit");

para("The mobile app and Cloud-PoS web back-office share a single Express REST API and a Replit-managed PostgreSQL database. All data is live and synchronized across both clients in real time — no polling delays or manual refresh required on any screen.");

sp(14);

// Architecture diagram
const archY = doc.y;
const boxH = 66;

// Mobile client
doc.rect(ML, archY, 152, boxH).fill(LT_BLUE);
doc.rect(ML, archY, 152, 3).fill(BLUE);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9.5).text("Cloud POS Mobile App", ML + 8, archY + 10, { width: 136 });
doc.fillColor(G500).font("Helvetica").fontSize(8).text("Expo / React Native\niOS + Android\nNFC Tap to Pay\nTanStack React Query", ML + 8, archY + 24, { width: 136 });

// Web client
const wbx = PW - MR - 152;
doc.rect(wbx, archY, 152, boxH).fill(LT_BLUE);
doc.rect(wbx, archY, 152, 3).fill(NAVY);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9.5).text("Cloud-PoS Web App", wbx + 8, archY + 10, { width: 136 });
doc.fillColor(G500).font("Helvetica").fontSize(8).text("React + Vite (browser)\nAny modern browser\nInventory · Analytics\nEmployee management", wbx + 8, archY + 24, { width: 136 });

// API box (centre)
const apiY = archY + boxH + 32;
const apiX = PW / 2 - 80;
doc.rect(apiX, apiY, 160, 42).fill(NAVY);
doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(9.5).text("Node.js Express REST API", apiX + 8, apiY + 8, { width: 144, align: "center" });
doc.fillColor("rgba(255,255,255,0.65)").font("Helvetica").fontSize(8).text("Shared across Mobile + Web  ·  Always-on", apiX + 8, apiY + 24, { width: 144, align: "center" });

// DB box
const dbY = apiY + 62;
doc.rect(apiX, dbY, 160, 42).fill(BLUE);
doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(9.5).text("PostgreSQL Database", apiX + 8, dbY + 8, { width: 144, align: "center" });
doc.fillColor("rgba(255,255,255,0.8)").font("Helvetica").fontSize(8).text("Replit-managed  ·  Always-on  ·  Live sync", apiX + 8, dbY + 24, { width: 144, align: "center" });

// Arrows
function arrow(x1, y1, x2, y2) {
  doc.moveTo(x1, y1).lineTo(x2, y2).strokeColor(BLUE).lineWidth(1.5).stroke();
  const a = Math.atan2(y2 - y1, x2 - x1);
  doc.moveTo(x2, y2)
    .lineTo(x2 - 7 * Math.cos(a - 0.4), y2 - 7 * Math.sin(a - 0.4))
    .lineTo(x2 - 7 * Math.cos(a + 0.4), y2 - 7 * Math.sin(a + 0.4))
    .closePath().fill(BLUE);
}
arrow(ML + 152, archY + 33, apiX, apiY + 21);
arrow(wbx, archY + 33, apiX + 160, apiY + 21);
arrow(PW / 2, apiY + 42, PW / 2, dbY);

// Side integrations
const intY = archY + boxH + 32;
doc.rect(ML, intY, 100, 34).fill(G100);
doc.fillColor(G700).font("Helvetica-Bold").fontSize(8).text("Elavon / Converge", ML + 6, intY + 7, { width: 88 });
doc.fillColor(G500).font("Helvetica").fontSize(7.5).text("Payment processing", ML + 6, intY + 18, { width: 88 });
arrow(ML + 100, intY + 17, apiX, apiY + 21);

doc.rect(wbx + 52, intY, 100, 34).fill(G100);
doc.fillColor(G700).font("Helvetica-Bold").fontSize(8).text("Resend Email API", wbx + 58, intY + 7, { width: 88 });
doc.fillColor(G500).font("Helvetica").fontSize(7.5).text("Invoice portal emails", wbx + 58, intY + 18, { width: 88 });
arrow(wbx + 52, intY + 17, apiX + 160, apiY + 21);

doc.y = dbY + 52;
rule();

secTitle("Data Flow Summary");
sp(4);
const flows = [
  ["New Order → Kitchen",    "Order created → DB → Kitchen ticket auto-generated → KDS updates within 8 seconds."],
  ["Payment → Loyalty",      "Payment complete → Loyalty points credited → Tier evaluated → Customer record updated."],
  ["Mobile ↔ Web Sync",      "Orders, customers, menu items read from shared DB — perfectly in sync between both clients."],
  ["Customer Sync",          "One-tap import from Cloud-PoS CRM → merges points and visit data by max(local, cloud)."],
  ["Quote → Invoice",        "Quote accepted → converts to invoice → payment link emailed via Resend → status tracked."],
  ["Settings → App",         "Industry mode change in Settings instantly reconfigures navigation, labels, and feature set."],
];
const fc = [{ w: 160, label: "Data Flow" }, { w: CW - 160, label: "Description" }];
let fy = doc.y;
fy = tHead(fc, fy);
flows.forEach((r, i) => { fy = tRow(fc, r, fy, i % 2 === 0); });
doc.y = fy + 10;

sp(8);
secTitle("Technology Stack");
sp(4);
const layers = [
  { l: "iOS & Android Native UI",  sub: "Expo React Native  ·  Expo Router (file-based nav)  ·  React Native Reanimated 3", c: "#DBEAFE" },
  { l: "State & Data Layer",       sub: "TanStack React Query  ·  30s stale time  ·  Optimistic updates  ·  Offline cache", c: "#EDE9FE" },
  { l: "API Server",               sub: "Node.js + Express + TypeScript  ·  Drizzle ORM  ·  express-session", c: LT_BLUE },
  { l: "Database",                 sub: "PostgreSQL (Replit-managed)  ·  11+ tables  ·  Shared across web and mobile", c: "#F0FDF4" },
  { l: "Platform & Distribution",  sub: "Replit cloud (always-on)  ·  EAS Build for signed iOS/Android binaries", c: G100 },
];
layers.forEach(layer => {
  need(28);
  const y = doc.y;
  doc.rect(ML, y, CW, 24).fill(layer.c);
  doc.rect(ML, y, 3, 24).fill(BLUE);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text(layer.l, ML + 10, y + 4, { width: 170 });
  doc.fillColor(G500).font("Helvetica").fontSize(8).text(layer.sub, ML + 184, y + 7, { width: CW - 190 });
  doc.y = y + 25;
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 5  — INDUSTRY MODES
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("3. Industry Modes", "Restaurant · Retail · Service — one app, three complete operating configurations");

para("Cloud POS Mobile adapts its entire interface, navigation, and feature set based on the selected Industry Mode in Settings. Switching modes takes effect immediately without restarting. Each mode enables the appropriate screens, reconfigures tab labels, and adjusts product category suggestions.");

sp(10);

const modes = [
  {
    name: "Restaurant Mode", emoji: "🍽️", color: NAVY, bg: LT_BLUE,
    tabs: ["Orders", "Tables", "Kitchen", "Menu", "History", "Back Office", "Settings"],
    features: [
      "Visual table floor plan organized by section (Main, Bar, Patio, Private)",
      "Kitchen Display System (KDS) — real-time ticket queue for back-of-house",
      "Table statuses: Available · Occupied · Reserved · Cleaning",
      "Guest count and elapsed time per occupied table",
      "Integrated reservation calendar with confirmation workflow",
      "Menu categories: Appetizers · Mains · Desserts · Beverages · Specials · Sides",
      "Pricing types: Fixed · By Unit · By Weight",
    ],
    phone: screenOrders,
  },
  {
    name: "Service Mode", emoji: "✂️", color: "#1E3A8A", bg: "#DBEAFE",
    tabs: ["Orders", "Appointments", "Invoices", "Customers", "Menu", "History", "Back Office", "Settings"],
    features: [
      "Appointment calendar — month/day navigation with booking density dots",
      "Status lifecycle: Pending → Confirmed → In-Progress → Completed",
      "Staff/stylist assignment and duration tracking per appointment",
      "Quote creation with line-item catalog browsing",
      "Quote-to-invoice conversion with payment portal link generation",
      "Net payment terms: Due on Receipt · Net 7 / 15 / 30 / 45 / 60",
      "Pricing types: Fixed · Hourly",
    ],
    phone: screenAppointments,
  },
  {
    name: "Retail Mode", emoji: "🛍️", color: "#166534", bg: "#DCFCE7",
    tabs: ["Orders", "Customers", "Invoices", "Catalog", "History", "Back Office", "Settings"],
    features: [
      "Product catalog with SKU-level identification",
      "Categories: Clothing · Accessories · Electronics · Food & Drink · Other",
      "Fixed and Per-Unit pricing types",
      "Customer loyalty tracking with tier badges on all customer records",
      "Invoice generation for B2B and wholesale orders",
      "Contactless card and Apple Pay checkout from mobile",
      "Cash tendered with quick-amount shortcuts and change display",
    ],
    phone: screenSettings,
  },
];

modes.forEach(mode => {
  need(200);
  const y = doc.y;

  // Left side — phone mockup
  const mPhoneW = 100, mPhoneH = 196;
  drawPhone(ML, y, {
    w: mPhoneW, h: mPhoneH,
    caption: mode.name,
    screen: (sx, cy, sw) => mode.phone(sx, cy, sw),
  });

  // Right side — content
  const cx = ML + mPhoneW + 16;
  const cw = CW - mPhoneW - 16;

  doc.rect(cx, y, cw, 24).fill(mode.color);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(12)
    .text(`${mode.emoji}  ${mode.name}`, cx + 10, y + 6, { width: cw - 20 });

  // Tab pills
  const tabY = y + 26;
  doc.rect(cx, tabY, cw, 18).fill(mode.bg);
  let tx2 = cx + 4;
  mode.tabs.forEach(tab => {
    const tw3 = doc.widthOfString(tab, { fontSize: 6.5 }) + 10;
    if (tx2 + tw3 > cx + cw - 4) return;
    doc.rect(tx2, tabY + 3, tw3, 12).fill(mode.color);
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6)
      .text(tab, tx2 + 2, tabY + 6.5, { width: tw3 - 4 });
    tx2 += tw3 + 4;
  });

  // Feature bullets
  let fy2 = tabY + 22;
  mode.features.forEach(feat => {
    doc.circle(cx + 7, fy2 + 4.5, 2).fill(mode.color);
    doc.fillColor(G500).font("Helvetica").fontSize(8)
      .text(feat, cx + 14, fy2, { width: cw - 14 });
    fy2 += 13;
  });

  doc.y = Math.max(y + mPhoneH + 14, fy2 + 8);
  rule();
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 6  — ORDERS
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("4.1  Orders & Live Dashboard", "Real-time order queue, KPI cards, and intelligent operational alerts");

// Phone + description side by side
const oPhoneW = 120, oPhoneH = 240;
drawPhone(ML, doc.y, {
  w: oPhoneW, h: oPhoneH, caption: "Orders Tab",
  screen: (sx, cy, sw) => screenOrders(sx, cy, sw),
});

const ox = ML + oPhoneW + 18;
const ow = CW - oPhoneW - 18;
const oy = doc.y;

doc.fillColor(G500).font("Helvetica").fontSize(9)
  .text("The Orders tab is the app's home screen — a live feed of all active orders with KPI stat cards, POS alert banners, and a quick new-order shortcut. Data refreshes automatically every 30 seconds and supports pull-to-refresh.", ox, oy, { width: ow });

sp(10);

// KPI cards
const kpis2 = [["$1,842", "Revenue"], ["43", "Orders"], ["$42.84", "Avg Order"], ["12", "Open"]];
const kw2 = (ow - 12) / 4;
kpis2.forEach((k, i) => {
  kpi(ox + i * (kw2 + 4), oy + 56, kw2, 44, k[0], k[1]);
});

const alertY = oy + 108;
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text("POS Alert Banners", ox, alertY, { width: ow });

const alerts = [
  { title: "Stale Open Order", msg: "#ORD-2087 open for 47 min — check Table 5.", c: DANGER, bg: DANG_BG },
  { title: "No Sales in Past Hour", msg: "Quiet period detected — verify terminal.", c: WARN,   bg: WARN_BG },
  { title: "Multiple Open Orders", msg: "5 orders open simultaneously > 30 min.", c: G500,   bg: G100 },
];
let alertCur = alertY + 14;
alerts.forEach(a => {
  doc.rect(ox, alertCur, ow, 30).fill(a.bg);
  doc.rect(ox, alertCur, 3, 30).fill(a.c);
  doc.fillColor(a.c).font("Helvetica-Bold").fontSize(8).text(a.title, ox + 8, alertCur + 5, { width: ow - 60 });
  doc.fillColor(G500).font("Helvetica").fontSize(7.5).text(a.msg, ox + 8, alertCur + 16, { width: ow - 60 });
  doc.rect(ox + ow - 44, alertCur + 9, 38, 12).fill(a.c);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text("View", ox + ow - 44, alertCur + 12.5, { width: 38, align: "center" });
  alertCur += 36;
});

doc.y = oy + oPhoneH + 14;
rule();

secTitle("Orders Screen Features");
sp(4);
[
  "Real-time order list with automatic 30-second background refresh — no manual action needed",
  "Pull-to-refresh gesture for immediate manual data sync at any time",
  "Tap any order card to open full order detail — edit items, void, or proceed to checkout",
  "+ button launches cart builder with full category-filtered menu access",
  "Status badges: Open (green) · Paid (gray) · Voided (red) — instantly scannable",
  "POS alert banners auto-dismiss when the underlying condition resolves",
  "Dark mode support — all colours adapt to iOS/Android system appearance setting",
  "Haptic feedback on tap for tactile confirmation without audio disruption",
].forEach(f => bullet(f));

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 7  — NEW ORDER FLOW
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("4.2  New Order Flow & Cart Builder", "Touch-optimised menu browsing, cart management, and modifier selection");

para("The New Order screen is a full-screen cart builder with category-filtered menu browsing. Staff add items, adjust quantities, apply modifiers, add notes, optionally assign a table, and proceed to checkout — all in a single fluid flow.");

sp(10);
secTitle("Order Creation Flow");
sp(6);

const steps = ["Tap +\non Orders", "Browse Menu\nby Category", "Tap Item\nto Add", "Modify &\nAdd Notes", "Assign Table\n(optional)", "Tap Charge\nto Pay"];
const sw3 = (CW - 20) / steps.length;
const sy = doc.y;
steps.forEach((s, i) => {
  const bx = ML + i * (sw3 + 4);
  const last = i === steps.length - 1;
  doc.rect(bx, sy, sw3, 34).fill(last ? NAVY : LT_BLUE);
  doc.fillColor(last ? WHITE : NAVY).font("Helvetica-Bold").fontSize(7.5).text(s, bx + 2, sy + 5, { width: sw3 - 4, align: "center" });
  doc.fillColor(last ? "rgba(255,255,255,0.5)" : G400).font("Helvetica").fontSize(6.5)
    .text(`Step ${i + 1}`, bx, sy + 27, { width: sw3, align: "center" });
  if (!last) {
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(9).text("▶", bx + sw3 + 1, sy + 11, { width: 4 });
  }
});
doc.y = sy + 44;

rule();
secTitle("Sample Menu (Restaurant Mode)");
sp(4);

const mCols = [{ w: 28, label: "" }, { w: 166, label: "Item" }, { w: 100, label: "Category" }, { w: 90, label: "Price" }, { w: CW - 384, label: "Pricing Type" }];
let my = doc.y;
my = tHead(mCols, my);
const mItems = [
  ["🍔", "House Burger",         "Mains",     "$14.99", "Fixed"],
  ["🥗", "Caesar Salad",         "Salads",    "$11.50", "Fixed"],
  ["🍕", "Margherita Pizza",     "Mains",     "$16.50", "Fixed"],
  ["🍺", "Craft Beer (IPA)",     "Beverages", "$7.00",  "Per Unit"],
  ["🍷", "House Wine",           "Beverages", "$9.00",  "Per Unit"],
  ["🍰", "Tiramisu",             "Desserts",  "$8.00",  "Fixed"],
  ["☕", "Coffee",               "Beverages", "$4.00",  "Fixed"],
  ["🍫", "Chocolate Lava Cake",  "Desserts",  "$9.50",  "Fixed"],
];
mItems.forEach((row, i) => {
  const ry = my;
  if (i % 2 === 0) doc.rect(ML, ry, CW, 18).fill(G50);
  doc.fillColor(G700).font("Helvetica").fontSize(11).text(row[0], ML + 5, ry + 2);
  [1, 2, 3, 4].forEach((ci, colIdx) => {
    const cx2 = ML + mCols.slice(0, ci).reduce((a, c) => a + c.w, 0);
    const color = ci === 3 ? NAVY : G700;
    const bold = ci === 3;
    doc.fillColor(color).font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5)
      .text(row[ci], cx2 + 5, ry + 4.5, { width: mCols[ci].w - 10 });
  });
  doc.rect(ML, ry + 17.5, CW, 0.5).fill(G200);
  my = ry + 18;
});
doc.y = my + 10;

rule();
secTitle("Modifier System");
sp(4);
para("Tapping a cart item opens the Modifier Sheet — a native bottom sheet where staff select pre-configured modifier groups and add a free-text kitchen note. Modifier selections print on the kitchen ticket automatically.");
sp(6);
[
  ["Cooking Temp",   "Rare · Medium-Rare · Medium · Well-Done"],
  ["Add-ons",        "Extra Cheese · Bacon · Avocado · Extra Sauce (+ price)"],
  ["Dietary",        "Gluten-Free · No Onion · Nut Allergy · Vegan"],
  ["Portion",        "Half Portion (−$2) · Full Portion · Double Portion"],
  ["Kitchen Note",   "Free-text field — printed verbatim on the kitchen ticket"],
].forEach(([k, v]) => {
  need(14);
  const y = doc.y;
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8.5).text(k + ":", ML, y, { width: 120 });
  doc.fillColor(G500).font("Helvetica").fontSize(8.5).text(v, ML + 126, y, { width: CW - 126 });
  doc.y = y + 13;
});

sp(8);
secTitle("Cart Features");
sp(4);
[
  "Live subtotal, tax (8.875% default), and grand total update instantly as items are added or removed",
  "Quantity stepper per line item — tap to increment, swipe to remove entirely",
  "Per-item notes field (e.g. 'no cilantro') — notes flow through to the kitchen ticket",
  "Table number field — leave blank for a walk-in POS sale, or type a table number",
  "Charge button is disabled until at least one item is in the cart — prevents accidental empty orders",
].forEach(f => bullet(f));

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 8  — CHECKOUT & PAYMENTS
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("4.3  Checkout & Payments", "NFC Tap to Pay · Cash with Change · Card · Elavon / Converge Integration");

// Checkout phone + description
const cpW = 118, cpH = 238;
drawPhone(ML, doc.y, {
  w: cpW, h: cpH, caption: "Checkout Screen",
  screen: (sx, cy, sw) => screenCheckout(sx, cy, sw),
});
const cpx = ML + cpW + 18, cpw = CW - cpW - 18;
const coy = doc.y;

doc.fillColor(G500).font("Helvetica").fontSize(9)
  .text("The Checkout screen supports three payment methods — NFC Tap to Pay, Credit/Debit Card, and Cash. All payments process through Elavon/Converge and create a permanent transaction record.", cpx, coy, { width: cpw });

sp(14);

// Tap to Pay steps
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9.5).text("NFC Tap to Pay — Step by Step", cpx, coy + 46, { width: cpw });
const ttpSteps = [
  ["1", "Open Checkout",   "Tap Charge. Select Card. iPhone activates NFC."],
  ["2", "NFC Session",     "iOS NFC overlay appears — the iPhone IS the reader."],
  ["3", "Customer Taps",   "Card, Apple Pay, or Apple Watch touched to top of iPhone."],
  ["4", "Tag Detected",    "ISO 14443 Tag APDU read. Haptic confirms detection."],
  ["5", "Processing",      "Transaction sent to Elavon/Converge. < 2 seconds."],
  ["6", "Approved",        "Green checkmark + haptic. Order marked Paid instantly."],
];
let tpY = coy + 62;
ttpSteps.forEach(s => {
  doc.circle(cpx + 9, tpY + 4.5, 8).fill(BLUE);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(7).text(s[0], cpx + 5, tpY + 1.5, { width: 9, align: "center" });
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8.5).text(s[1], cpx + 24, tpY, { width: cpw - 24 });
  doc.fillColor(G500).font("Helvetica").fontSize(8).text(s[2], cpx + 24, tpY + 11, { width: cpw - 24 });
  if (s[0] < "6") {
    doc.moveTo(cpx + 9, tpY + 13).lineTo(cpx + 9, tpY + 22).strokeColor(BLUE).lineWidth(1).stroke();
  }
  tpY += 26;
});

doc.y = coy + cpH + 12;
rule();

secTitle("Accepted Contactless Payment Types");
sp(4);
const ttpTypes = [
  ["Visa Contactless",         "AID: A0000000031010 / A0000000032010"],
  ["Mastercard Contactless",   "AID: A0000000041010"],
  ["American Express",         "AID: A00000002501"],
  ["Discover",                 "AID: A0000001523010"],
  ["Apple Pay",                "Uses card's AID via the Secure Element — same NFC session"],
  ["Apple Watch",              "Same protocol as iPhone Apple Pay"],
  ["Google Pay (Android)",     "Host-based Card Emulation (HCE) on Android devices"],
];
const ttcols = [{ w: 180, label: "Payment Type" }, { w: CW - 180, label: "Technical Detail" }];
let ttY = doc.y;
ttY = tHead(ttcols, ttY);
ttpTypes.forEach((r, i) => { ttY = tRow(ttcols, r, ttY, i % 2 === 0); });
doc.y = ttY + 10;

rule();
secTitle("Cash Payment with Change Calculation");
sp(4);

// Cash UI mockup (inline box)
const cashY = doc.y;
doc.rect(ML, cashY, 220, 84).fill(G50);
doc.rect(ML, cashY, 220, 3).fill(NAVY);
doc.fillColor(G500).font("Helvetica").fontSize(7.5).text("Amount Tendered", ML + 8, cashY + 10);
doc.rect(ML + 8, cashY + 20, 204, 20).fill(WHITE).stroke(BLUE).lineWidth(0.8);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(14).text("$80.00", ML + 14, cashY + 24.5, { width: 198 });
doc.fillColor(G500).font("Helvetica").fontSize(7).text("Quick amounts:", ML + 8, cashY + 46);
["$20", "$40", "$60", "$80", "Exact"].forEach((a, i) => {
  doc.rect(ML + 8 + i * 40, cashY + 55, 36, 14).fill(LT_BLUE);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(7.5).text(a, ML + 8 + i * 40, cashY + 59, { width: 36, align: "center" });
});
doc.rect(ML + 8, cashY + 73, 110, 10).fill(SUCC_BG);
doc.fillColor(SUCCESS).font("Helvetica-Bold").fontSize(7.5).text("Change Due:  $11.50", ML + 10, cashY + 75.5);

doc.fillColor(G500).font("Helvetica").fontSize(8.5)
  .text("Cash payments show a full-screen tendered amount entry with quick-amount shortcuts. Change due is calculated and displayed prominently before confirming. Cash transactions are logged separately for end-of-day reconciliation.", ML + 228, cashY + 4, { width: CW - 234 });
doc.y = cashY + 92;

rule();
secTitle("Payment Success Screen");
sp(4);
[
  "Full-screen success state shows: order number, total charged, payment method label, and change due (cash)",
  "Contactless payments labeled 'Contactless' on receipt and in order history",
  "Order status changes to Paid — removed from active queue immediately",
  "Loyalty points credited to customer account if the order was customer-linked",
  "Kitchen ticket status updated to reflect payment completion",
].forEach(f => bullet(f));

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 9  — TABLE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("4.4  Table Management & Reservations", "Visual floor plan · Real-time status · Integrated reservation calendar");

const tPhW = 118, tPhH = 238;
drawPhone(ML, doc.y, {
  w: tPhW, h: tPhH, caption: "Tables Screen",
  screen: (sx, cy, sw) => screenTables(sx, cy, sw),
});
const tpx = ML + tPhW + 18, tpw = CW - tPhW - 18;
const tpy = doc.y;

doc.fillColor(G500).font("Helvetica").fontSize(9)
  .text("The Tables tab provides a real-time visual floor plan organized by section. Staff see occupancy status, time elapsed since seating, running order total, and guest count at a glance.", tpx, tpy, { width: tpw });

sp(12);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text("Table Status Types", tpx, tpy + 40, { width: tpw });

const statuses = [
  { s: "Available", c: SUCCESS, bg: SUCC_BG, d: "Empty, ready to be seated" },
  { s: "Occupied",  c: WARN,    bg: WARN_BG, d: "Guests seated — shows time & running total" },
  { s: "Reserved",  c: BLUE,    bg: LT_BLUE, d: "Advance booking holds the table" },
  { s: "Cleaning",  c: DANGER,  bg: DANG_BG, d: "Turned over — being cleaned before re-seating" },
];
let stY = tpy + 56;
statuses.forEach(s => {
  badge(tpx, stY, s.s, s.c, s.bg);
  doc.fillColor(G500).font("Helvetica").fontSize(8).text(s.d, tpx + 82, stY + 1, { width: tpw - 82 });
  stY += 16;
});

doc.y = tpy + tPhH + 12;
rule();

secTitle("Sample Floor Plan");
sp(4);
const sections2 = [
  { name: "Main Dining", tables: [
    { n: "T1", s: "available", c: SUCCESS, bg: SUCC_BG },
    { n: "T2", s: "occupied",  c: WARN,    bg: WARN_BG, sub: "34m · $88" },
    { n: "T3", s: "occupied",  c: WARN,    bg: WARN_BG, sub: "12m · $42" },
    { n: "T4", s: "reserved",  c: BLUE,    bg: LT_BLUE },
    { n: "T5", s: "available", c: SUCCESS, bg: SUCC_BG },
    { n: "T6", s: "cleaning",  c: DANGER,  bg: DANG_BG },
  ]},
  { name: "Bar", tables: [
    { n: "B1", s: "occupied",  c: WARN,    bg: WARN_BG, sub: "8m · $28" },
    { n: "B2", s: "available", c: SUCCESS, bg: SUCC_BG },
    { n: "B3", s: "occupied",  c: WARN,    bg: WARN_BG, sub: "5m · $14" },
  ]},
];
sections2.forEach(sec => {
  need(80);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text(sec.name, ML, doc.y, { width: CW });
  doc.y += 12;
  const startY = doc.y;
  let tx3 = ML;
  sec.tables.forEach(t => {
    const tw4 = 78, th4 = 48;
    doc.rect(tx3, startY, tw4, th4).fill(t.bg);
    doc.rect(tx3, startY, tw4, 3).fill(t.c);
    doc.fillColor(t.c).font("Helvetica-Bold").fontSize(12).text(t.n, tx3, startY + 7, { width: tw4, align: "center" });
    doc.fillColor(t.c).font("Helvetica-Bold").fontSize(7).text(t.s.charAt(0).toUpperCase() + t.s.slice(1), tx3, startY + 23, { width: tw4, align: "center" });
    if (t.sub) doc.fillColor(G700).font("Helvetica").fontSize(7).text(t.sub, tx3, startY + 34, { width: tw4, align: "center" });
    tx3 += tw4 + 5;
  });
  doc.y = startY + 56;
  sp(4);
});

rule();
secTitle("Reservation System");
sp(4);
const resCols = [
  { w: 120, label: "Guest" }, { w: 90, label: "Date" }, { w: 70, label: "Time" },
  { w: 60, label: "Party" }, { w: 60, label: "Table" }, { w: CW - 400, label: "Status" },
];
let resY = doc.y;
resY = tHead(resCols, resY);
[
  ["Thompson Party",   "Mar 22, 2026", "7:00 PM", "6", "T4", "Confirmed"],
  ["Chen, Emily",      "Mar 22, 2026", "7:30 PM", "2", "T1", "Pending"],
  ["Rivera Group",     "Mar 23, 2026", "6:00 PM", "8", "T7", "Confirmed"],
  ["Williams, Marcus", "Mar 24, 2026", "7:00 PM", "3", "B2", "Confirmed"],
].forEach((r, i) => { resY = tRow(resCols, r, resY, i % 2 === 0); });
doc.y = resY + 10;

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 10  — KITCHEN DISPLAY
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("4.5  Kitchen Display System (KDS)", "Live ticket queue · Status progression · Elapsed timers · Modifier notes");

const kPhW = 118, kPhH = 240;
drawPhone(ML, doc.y, {
  w: kPhW, h: kPhH, caption: "Kitchen Display",
  screen: (sx, cy, sw) => screenKitchen(sx, cy, sw),
});
const kpx = ML + kPhW + 18, kpw = CW - kPhW - 18;
const koy = doc.y;

doc.fillColor(G500).font("Helvetica").fontSize(9)
  .text("The Kitchen tab is a purpose-built kitchen-facing display. All orders submitted from the mobile app or Cloud-PoS web POS appear here within 8 seconds. Kitchen staff advance tickets through four stages — each tap records a timestamp.", kpx, koy, { width: kpw });

sp(12);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text("Ticket Status Flow", kpx, koy + 56, { width: kpw });

const kStatuses = [
  { l: "New Order",  c: DANGER,  bg: DANG_BG, btn: "Start Prep" },
  { l: "Preparing",  c: WARN,    bg: WARN_BG,  btn: "Mark Ready" },
  { l: "Ready",      c: SUCCESS, bg: SUCC_BG,  btn: "Served" },
  { l: "Served",     c: G500,    bg: G100,     btn: "" },
];
const ksw = (kpw - 12) / 4;
let ksY = koy + 70;
kStatuses.forEach((s, i) => {
  const kx = kpx + i * (ksw + 4);
  doc.rect(kx, ksY, ksw, 52).fill(s.bg);
  doc.rect(kx, ksY, ksw, 3).fill(s.c);
  doc.fillColor(s.c).font("Helvetica-Bold").fontSize(8).text(s.l, kx, ksY + 10, { width: ksw, align: "center" });
  if (s.btn) {
    doc.rect(kx + 4, ksY + 38, ksw - 8, 12).fill(s.c);
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6).text(s.btn, kx + 4, ksY + 41.5, { width: ksw - 8, align: "center" });
  }
  if (i < 3) {
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(9).text("▶", kx + ksw + 1, ksY + 17, { width: 4 });
  }
});

doc.y = koy + kPhH + 12;
rule();

secTitle("Sample Kitchen Tickets");
sp(6);
const tix = [
  { num: "#ORD-2091", table: "Table 7 · 3 guests", time: "8m", status: "NEW",  c: DANGER,  bg: DANG_BG, bar: "#EF4444",
    items: ["2×  House Burger  (1× no onion)", "1×  Caesar Salad  (dressing on side)", "2×  Craft Beer (IPA)"] },
  { num: "#ORD-2090", table: "Table 3 · 2 guests", time: "4m", status: "PREP", c: WARN,    bg: WARN_BG,  bar: "#F59E0B",
    items: ["1×  Margherita Pizza  (extra basil)", "1×  Tiramisu"] },
];
tix.forEach(t => {
  need(80);
  const y = doc.y;
  const th5 = 74;
  doc.rect(ML, y, CW / 2 - 6, th5).fill(t.bg);
  doc.rect(ML, y, 5, th5).fill(t.bar);
  doc.fillColor(t.c).font("Helvetica-Bold").fontSize(10).text(t.num, ML + 12, y + 8, { width: 130 });
  doc.fillColor(G500).font("Helvetica").fontSize(8).text(t.table, ML + 12, y + 22);
  doc.rect(CW / 2 - 38, y + 6, 36, 14).fill(t.c + "25");
  doc.fillColor(t.c).font("Helvetica-Bold").fontSize(7.5).text("⏱ " + t.time, CW / 2 - 38, y + 10, { width: 36, align: "center" });
  t.items.forEach((item, ii) => {
    doc.fillColor(G700).font("Helvetica").fontSize(8).text(item, ML + 12, y + 36 + ii * 11);
  });
  doc.y = y + th5 + 8;
});

rule();
secTitle("KDS Features");
sp(4);
[
  "Tickets appear within 8 seconds of order creation — auto-refresh polling every 15 seconds",
  "Tickets grouped by status: New · Preparing · Ready — section headers keep the queue organized",
  "Elapsed timer updates every 30 seconds — shifts from green to amber to red as time passes",
  "Table number and guest count shown prominently so servers know which order to collect",
  "Item-level modifier notes appear below each line item — kitchen sees full context",
  "One-tap status advance: each tap records a timestamp for kitchen performance reporting",
  "Served tickets move to a secondary 'Done' section, keeping the active queue clear",
].forEach(f => bullet(f));

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 11  — APPOINTMENTS
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("4.6  Appointments  (Service Mode)", "Full calendar booking · Staff assignment · Status lifecycle · Duration tracking");

const aPhW = 118, aPhH = 244;
drawPhone(ML, doc.y, {
  w: aPhW, h: aPhH, caption: "Appointments",
  screen: (sx, cy, sw) => screenAppointments(sx, cy, sw),
});
const apx = ML + aPhW + 18, apw = CW - aPhW - 18;
const aoy = doc.y;

doc.fillColor(G500).font("Helvetica").fontSize(9)
  .text("Available in Service Mode, the Appointments tab provides a complete booking management system. A swipe-able calendar shows appointment density by date. Staff create, confirm, and progress appointments through their full lifecycle with staff assignment and service duration tracking.", apx, aoy, { width: apw });

sp(12);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text("Status Lifecycle", apx, aoy + 60, { width: apw });
const apptStats = [
  { s: "Pending",     c: G500,    bg: G100,    d: "New booking awaiting staff confirmation" },
  { s: "Confirmed",   c: BLUE,    bg: LT_BLUE, d: "Staff confirmed — client notified" },
  { s: "In Progress", c: SUCCESS, bg: SUCC_BG, d: "Service underway — client in chair" },
  { s: "Completed",   c: G700,    bg: G100,    d: "Service done — ready for payment" },
  { s: "No Show",     c: DANGER,  bg: DANG_BG, d: "Client did not arrive — flagged for record" },
];
let asY = aoy + 76;
apptStats.forEach(s => {
  badge(apx, asY, s.s, s.c, s.bg);
  doc.fillColor(G500).font("Helvetica").fontSize(8).text(s.d, apx + 84, asY + 1, { width: apw - 84 });
  asY += 16;
});

doc.y = aoy + aPhH + 12;
rule();

secTitle("Sample Appointment Schedule — March 21, 2026");
sp(4);
const aCols = [
  { w: 72, label: "Time" }, { w: 114, label: "Client" }, { w: 120, label: "Service" },
  { w: 70, label: "Duration" }, { w: 90, label: "Staff" }, { w: CW - 466, label: "Status" },
];
let apY = doc.y;
apY = tHead(aCols, apY);
[
  ["9:00 AM",  "Sarah Johnson",   "Color Treatment",  "90 min", "Jordan Lee",   "In Progress"],
  ["9:30 AM",  "Emily Chen",      "Manicure",         "30 min", "Morgan Scott", "Confirmed"],
  ["10:30 AM", "Jennifer Park",   "Facial",           "60 min", "Taylor Kim",   "Confirmed"],
  ["11:00 AM", "Marcus Williams", "Haircut",          "45 min", "Alex Rivera",  "Pending"],
  ["1:00 PM",  "Robert Garcia",   "Massage (60 min)", "60 min", "Jordan Lee",   "Pending"],
  ["2:00 PM",  "Lisa Thompson",   "Pedicure",         "45 min", "Morgan Scott", "Confirmed"],
].forEach((r, i) => { apY = tRow(aCols, r, apY, i % 2 === 0); });
doc.y = apY + 10;

rule();
secTitle("Appointment Features");
sp(4);
[
  "Month-view calendar with dot indicators on booked dates — swipe to change months",
  "Day view lists all appointments for a selected date in chronological order",
  "Staff assignment per booking pulled from the employee roster",
  "Duration slots in 30-minute increments from 8:00 AM to 6:00 PM",
  "Completed appointments link directly to a new order for payment processing",
  "No-show flag logs the client behaviour for future loyalty and reporting",
].forEach(f => bullet(f));

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 12  — QUOTES & INVOICES
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("4.7  Quotes & Invoices", "Quote creation · Catalog browsing · Invoice conversion · Email payment links");

const iPhW = 118, iPhH = 244;
drawPhone(ML, doc.y, {
  w: iPhW, h: iPhH, caption: "Invoices Tab",
  screen: (sx, cy, sw) => screenInvoices(sx, cy, sw),
});
const ipx = ML + iPhW + 18, ipw = CW - iPhW - 18;
const ioy = doc.y;

doc.fillColor(G500).font("Helvetica").fontSize(9)
  .text("The Invoices tab provides a complete document workflow for service and retail businesses. Create estimates (quotes), send them for client review, convert accepted quotes to invoices, and track payment status — all from the mobile app. Clients receive a payment portal link by email.", ipx, ioy, { width: ipw });

sp(10);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text("Document Workflow", ipx, ioy + 56, { width: ipw });
const docFlow = ["Create\nQuote", "Send to\nClient", "Client\nAccepts", "Convert to\nInvoice", "Email\nLink", "Mark\nPaid"];
const dfw = (ipw - 16) / docFlow.length;
const dfY = ioy + 70;
docFlow.forEach((s, i) => {
  const dx = ipx + i * (dfw + 3);
  const last = i === docFlow.length - 1;
  doc.rect(dx, dfY, dfw, 30).fill(last ? SUCCESS : (i < 3 ? BLUE : NAVY));
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(6.5).text(s, dx + 2, dfY + 6, { width: dfw - 4, align: "center" });
  if (!last) doc.fillColor(BLUE).fontSize(9).font("Helvetica-Bold").text("▶", dx + dfw + 1, dfY + 8, { width: 3 });
});

doc.y = ioy + iPhH + 12;
rule();

secTitle("Status Types");
sp(4);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text("Quote Statuses", ML, doc.y, { width: CW / 2 - 8 });
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text("Invoice Statuses", ML + CW / 2 + 8, doc.y - 0, { width: CW / 2 });
doc.y += 12;

const qStats = [
  { s: "Draft",    c: G500,    bg: G100 },
  { s: "Sent",     c: BLUE,    bg: LT_BLUE },
  { s: "Accepted", c: SUCCESS, bg: SUCC_BG },
  { s: "Declined", c: DANGER,  bg: DANG_BG },
];
const iStats = [
  { s: "Unpaid",  c: WARN,    bg: WARN_BG },
  { s: "Paid",    c: SUCCESS, bg: SUCC_BG },
  { s: "Overdue", c: DANGER,  bg: DANG_BG },
  { s: "Voided",  c: G400,    bg: G100 },
];
qStats.forEach((s, i) => {
  const y = doc.y;
  badge(ML, y, s.s, s.c, s.bg);
  badge(ML + CW / 2 + 8, y, iStats[i].s, iStats[i].c, iStats[i].bg);
  doc.y = y + 16;
});

rule();
secTitle("Payment Terms");
sp(4);
const termCols = [{ w: 130, label: "Term" }, { w: 90, label: "Days" }, { w: CW - 220, label: "Best For" }];
let terY = doc.y;
terY = tHead(termCols, terY);
[
  ["Due on Receipt", "0 days",  "In-person service completion, immediate payment"],
  ["Net 7",         "7 days",  "Frequent clients, small invoices"],
  ["Net 15",        "15 days", "Regular B2B clients"],
  ["Net 30",        "30 days", "Standard commercial invoicing"],
  ["Net 45",        "45 days", "Larger projects, wholesale"],
  ["Net 60",        "60 days", "Enterprise clients, large volume contracts"],
].forEach((r, i) => { terY = tRow(termCols, r, terY, i % 2 === 0); });
doc.y = terY + 10;

rule();
secTitle("Email Portal");
sp(4);
[
  "Payment portal hosted at: https://cloud-po-s-wilcoxisaac.replit.app/api/portal — always live",
  "Portal link included in every invoice and quote email — clients pay via browser, no account needed",
  "Overdue detection is automatic — any invoice past its due date with 'unpaid' status is flagged red",
  "Native Share Sheet: tap Share on any invoice to share the portal link via iMessage, email, or any app",
  "Email delivery via Resend API — PORTAL_BASE_URL and FROM_EMAIL configured per deployment",
].forEach(f => bullet(f));

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 13  — CUSTOMERS & LOYALTY
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("4.8  Customer CRM & Loyalty Program", "4-tier loyalty · Cloud POS sync · Visit history · Purchase analytics");

const cPhW = 118, cPhH = 242;
drawPhone(ML, doc.y, {
  w: cPhW, h: cPhH, caption: "Customers Tab",
  screen: (sx, cy, sw) => screenCustomers(sx, cy, sw),
});
const cpx2 = ML + cPhW + 18, cpw2 = CW - cPhW - 18;
const coy2 = doc.y;

doc.fillColor(G500).font("Helvetica").fontSize(9)
  .text("The Customers tab is a full CRM with a built-in 4-tier loyalty program. Customer records track visit history, lifetime spend, loyalty points, top purchased items, and recent invoices. One-tap sync imports all customers from Cloud-PoS, merging data intelligently.", cpx2, coy2, { width: cpw2 });

sp(10);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text("Loyalty Tier Thresholds", cpx2, coy2 + 56, { width: cpw2 });
const tierData = [
  { t: "Bronze",   icon: "🥉", c: BRONZE, bg: "#FEF3C7", min: "0",      max: "499 pts" },
  { t: "Silver",   icon: "🥈", c: SILVER, bg: G100,      min: "500",    max: "1,999 pts" },
  { t: "Gold",     icon: "🥇", c: GOLD,   bg: WARN_BG,   min: "2,000",  max: "4,999 pts" },
  { t: "Platinum", icon: "💎", c: PLAT,   bg: "#EDE9FE", min: "5,000",  max: "∞" },
];
const tierW = (cpw2 - 12) / 4;
tierData.forEach((td, i) => {
  const tx4 = cpx2 + i * (tierW + 4);
  const ty4 = coy2 + 70;
  doc.rect(tx4, ty4, tierW, 56).fill(td.bg);
  doc.rect(tx4, ty4, tierW, 3).fill(td.c);
  doc.fillColor(td.c).font("Helvetica").fontSize(16).text(td.icon, tx4, ty4 + 8, { width: tierW, align: "center" });
  doc.fillColor(td.c).font("Helvetica-Bold").fontSize(8).text(td.t, tx4, ty4 + 28, { width: tierW, align: "center" });
  doc.fillColor(G500).font("Helvetica").fontSize(7).text(`${td.min}–${td.max}`, tx4, ty4 + 40, { width: tierW, align: "center" });
});

doc.y = coy2 + cPhH + 12;
rule();

secTitle("Customer Roster");
sp(4);
const custCols = [
  { w: 118, label: "Customer" }, { w: 82, label: "Tier" }, { w: 52, label: "Visits" },
  { w: 66, label: "Points" }, { w: 100, label: "Last Visit" }, { w: CW - 418, label: "Notes" },
];
let cuY = doc.y;
cuY = tHead(custCols, cuY);
[
  ["Emily Chen",      "💎 Platinum", "24", "5,200", "Mar 19, 2026", "Prefers oat milk"],
  ["Jennifer Park",   "🥇 Gold",     "18", "3,100", "Mar 18, 2026", "Allergy: nuts"],
  ["Sarah Johnson",   "🥇 Gold",     "15", "2,450", "Mar 15, 2026", "VIP regular"],
  ["Marcus Williams", "🥈 Silver",    "8",  "890",   "Mar 12, 2026", ""],
  ["Robert Garcia",   "🥉 Bronze",    "3",  "150",   "Mar 8, 2026",  "New customer"],
].forEach((r, i) => { cuY = tRow(custCols, r, cuY, i % 2 === 0); });
doc.y = cuY + 10;

rule();
secTitle("Cloud POS Sync");
sp(4);
[
  "One-tap sync fetches all records from https://cloud-po-s-wilcoxisaac.replit.app/api/customers",
  "Match priority: Cloud POS ID → email address → name — prevents duplicate records",
  "Points merged by max(local, cloud) — customers never lose points during a sync",
  "Visit count merged by max(local, cloud) — same strategy ensures no data loss",
  "Last visit date merged by taking the most recent date from either system",
  "Sync timestamp displayed below the customer count so staff know when data is current",
].forEach(f => bullet(f));

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 14  — MENU MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("4.9  Menu / Product Catalog Management", "Full CRUD · Category organisation · Multi-industry pricing · SKU tracking");

para("The Menu tab (labelled 'Menu', 'Catalog', or 'Services' depending on industry mode) provides full product management. Staff add, edit, and remove items, set pricing types, assign categories, attach emoji icons, and manage SKUs — all from the mobile app, synced live to Cloud-PoS.");

sp(10);
secTitle("Product Fields");
sp(4);
const pfCols = [{ w: 120, label: "Field" }, { w: CW - 120, label: "Description" }];
let pfY = doc.y;
pfY = tHead(pfCols, pfY);
[
  ["Name",         "Display name on menu grid and order tickets"],
  ["Description",  "Optional subtitle — shown in product detail and on quotes/invoices"],
  ["Price",        "Numeric USD price — interpreted per pricing type"],
  ["Category",     "Used for tab filtering on the order screen — industry-specific suggestions provided"],
  ["SKU",          "Stock-keeping unit identifier — optional, used for inventory cross-reference"],
  ["Emoji",        "Visual icon on menu grid — selected from a curated 20-emoji palette"],
  ["Pricing Type", "Fixed · Hourly (Service) · By Weight (Restaurant) · Per Unit (Retail)"],
].forEach((r, i) => { pfY = tRow(pfCols, r, pfY, i % 2 === 0); });
doc.y = pfY + 10;

rule();
secTitle("Pricing Types by Industry");
sp(4);
[
  { mode: "🍽️  Restaurant", types: ["Fixed — $14.99 each", "By Weight — $32.00/lb", "Per Unit — $7.00/glass"] },
  { mode: "✂️  Service",    types: ["Fixed — $45.00 flat", "Hourly — $80.00/hr"] },
  { mode: "🛍️  Retail",     types: ["Fixed — $29.99 each", "Per Unit — $12.00/bag"] },
].forEach(pm => {
  need(56);
  const y = doc.y;
  doc.rect(ML, y, CW, 16).fill(NAVY);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(9).text(pm.mode, ML + 8, y + 4, { width: CW - 16 });
  doc.y = y + 16;
  pm.types.forEach((t, i) => {
    const ry = doc.y;
    if (i % 2 === 0) doc.rect(ML, ry, CW, 16).fill(G50);
    doc.fillColor(BLUE).font("Helvetica-Bold").fontSize(8).text(t.split(" — ")[0], ML + 8, ry + 4, { width: 80 });
    doc.fillColor(G500).font("Helvetica").fontSize(8).text(t.split(" — ")[1] || "", ML + 94, ry + 4, { width: CW - 94 });
    doc.y = ry + 16;
  });
  sp(6);
});

rule();
secTitle("Category Suggestions by Mode");
sp(4);
[
  ["🍽️  Restaurant", "Appetizers · Mains · Desserts · Beverages · Specials · Sides"],
  ["✂️  Service",    "Hair · Nails · Massage · Skin · Other Services"],
  ["🛍️  Retail",     "Clothing · Accessories · Electronics · Food & Drink · Other"],
].forEach(([mode, cats]) => {
  need(14);
  const y = doc.y;
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8.5).text(mode, ML, y, { width: 120 });
  doc.fillColor(G500).font("Helvetica").fontSize(8.5).text(cats, ML + 128, y, { width: CW - 128 });
  doc.y = y + 14;
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 15  — ORDER HISTORY
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("4.10  Order History", "Complete transaction log · Status filtering · Full receipt detail");

para("The History tab provides a scrollable log of all completed transactions — Paid and Voided. Filter by status, tap any order to view the full receipt with line items, modifiers, payment method, timestamps, and tax breakdown.");

sp(10);
secTitle("History Card Layout");
sp(6);
[
  { num: "#ORD-2089", date: "Mar 21, 2026 · 1:42 PM", items: "3 items · Contactless", total: "$68.50", status: "PAID",   sc: SUCCESS, sb: SUCC_BG },
  { num: "#ORD-2088", date: "Mar 21, 2026 · 12:11 PM",items: "2 items · Cash",        total: "$28.00", status: "PAID",   sc: SUCCESS, sb: SUCC_BG },
  { num: "#ORD-2087", date: "Mar 21, 2026 · 11:55 AM",items: "5 items · Card",         total: "$94.25", status: "PAID",   sc: SUCCESS, sb: SUCC_BG },
  { num: "#ORD-2085", date: "Mar 21, 2026 · 10:22 AM",items: "1 item",                 total: "$14.99", status: "VOIDED", sc: DANGER,  sb: DANG_BG },
  { num: "#ORD-2083", date: "Mar 20, 2026 · 7:38 PM", items: "4 items · Contactless",  total: "$112.00",status: "PAID",   sc: SUCCESS, sb: SUCC_BG },
].forEach((o, i) => {
  need(38);
  const y = doc.y;
  if (i % 2 === 0) doc.rect(ML, y, CW, 36).fill(G50);
  doc.rect(ML, y, 4, 36).fill(o.sc);
  doc.rect(ML, y + 35.5, CW, 0.5).fill(G200);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9.5).text(o.num, ML + 12, y + 6, { width: 110 });
  doc.fillColor(G500).font("Helvetica").fontSize(8).text(o.date, ML + 12, y + 18, { width: 200 });
  doc.fillColor(G400).font("Helvetica").fontSize(7.5).text(o.items, ML + 12, y + 27, { width: 200 });
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(o.total, ML + 370, y + 9, { width: 80 });
  badge(ML + 460, y + 11, o.status, o.sc, o.sb);
  doc.y = y + 36;
});

rule();
secTitle("Full Receipt Detail");
sp(4);

const recY2 = doc.y;
doc.rect(ML, recY2, CW, 112).fill(G50);
doc.rect(ML, recY2, CW, 3).fill(NAVY);
doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text("Order  #ORD-2089", ML + 12, recY2 + 10, { width: 220 });
badge(ML + 380, recY2 + 10, "PAID · Contactless", SUCCESS, SUCC_BG);
doc.fillColor(G500).font("Helvetica").fontSize(8).text("Table 7  ·  Mar 21, 2026  ·  1:42 PM", ML + 12, recY2 + 24);

const recItems2 = [["House Burger × 2  (no onion)", "$29.98"], ["Caesar Salad × 1  (dressing on side)", "$11.50"], ["Craft Beer × 2", "$14.00"]];
let riy2 = recY2 + 38;
recItems2.forEach((item, i) => {
  if (i % 2 === 0) doc.rect(ML, riy2, CW, 14).fill(G100);
  doc.fillColor(G700).font("Helvetica").fontSize(8).text(item[0], ML + 12, riy2 + 3, { width: CW - 70 });
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8).text(item[1], PW - MR - 50, riy2 + 3, { width: 44, align: "right" });
  riy2 += 14;
});
doc.moveTo(ML + 300, riy2 + 4).lineTo(PW - MR, riy2 + 4).strokeColor(G200).lineWidth(0.5).stroke();
[["Subtotal", "$55.48"], ["Tax (8.875%)", "$4.92"], ["Total", "$60.40"]].forEach(([l, v], i) => {
  doc.fillColor(i === 2 ? NAVY : G500).font(i === 2 ? "Helvetica-Bold" : "Helvetica").fontSize(i === 2 ? 10 : 8)
    .text(l, PW - MR - 140, riy2 + 8 + i * 14, { width: 80 });
  doc.fillColor(i === 2 ? NAVY : G700).font(i === 2 ? "Helvetica-Bold" : "Helvetica").fontSize(i === 2 ? 12 : 8)
    .text(v, PW - MR - 52, riy2 + 7 + i * 14, { width: 46, align: "right" });
});
doc.y = recY2 + 118;

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 16  — BACK OFFICE
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("4.11  Back Office (Cloud-PoS Integration)", "Embedded live web view of the full Cloud-PoS management console");

para("The Back Office tab embeds the full Cloud-PoS web application directly inside the mobile app via a native WebView. It provides the complete management suite — inventory, analytics, employee management, detailed reporting, and all settings — without leaving the app.");

sp(10);
secTitle("Embedded Back-Office Modules");
sp(4);
const boCols = [{ w: 90, label: "URL Path" }, { w: 120, label: "Module" }, { w: CW - 210, label: "Description" }];
let boY = doc.y;
boY = tHead(boCols, boY);
[
  ["/dashboard", "Dashboard",         "Live KPIs, sales charts, top sellers, alerts, recent transactions"],
  ["/pos",       "POS Terminal",      "Web-based POS — full sales terminal accessible from mobile"],
  ["/inventory", "Inventory",         "SKU-level stock tracking, low/critical alerts, supplier management"],
  ["/customers", "Customer CRM",      "Full CRM with loyalty tracking and tier management"],
  ["/employees", "Employee Mgmt",     "Staff roster, live clock-in, payroll estimates, sales attribution"],
  ["/analytics", "Analytics",         "7-month revenue trend, category breakdown, export reports"],
  ["/tables",    "Table Management",  "Web floor plan, table status, and reservations"],
  ["/kitchen",   "Kitchen Display",   "Web KDS for kitchen staff with ticket management"],
  ["/orders",    "Orders History",    "Complete order log with date, method, and table filters"],
  ["/menu",      "Menu Management",   "Add/edit/remove menu items via web interface"],
  ["/settings",  "Settings",          "7 sections: Business, Payments, Tax, Notifications, Security, Display, Hardware"],
].forEach((r, i) => { boY = tRow(boCols, r, boY, i % 2 === 0); });
doc.y = boY + 10;

rule();
secTitle("Industry Mode Sync");
sp(4);
para("When the Back Office tab gains focus, the app reads the industry setting from the Cloud-PoS API. If the web admin has changed the business type, the mobile app automatically switches modes — reconfiguring its navigation and feature set to match.");
sp(6);
[
  "Industry sync polls every 8 seconds while the Back Office tab is active",
  "45-second stale threshold — webview reloads automatically if the tab was backgrounded",
  "Error state with retry button if the Cloud-PoS server is temporarily unreachable",
  "Back Office URL: https://cloud-po-s-wilcoxisaac.replit.app — always-on Replit deployment",
].forEach(f => bullet(f));

rule();
secTitle("Cloud-PoS Key Capabilities  (accessible via Back Office)");
sp(4);
[
  ["Dashboard",   "$761 today's revenue · 19 transactions · 4 covers · $40 avg order — all live"],
  ["POS Terminal","Category-filtered menu grid · live cart · one-tap Elavon checkout"],
  ["Inventory",   "10 items tracked · 1 critical (House Wine — 3 bottles) · 3 low stock · $508 total value"],
  ["Analytics",   "$31.2K March revenue · 441 transactions · 7-month trend · category breakdown"],
  ["Employees",   "5 staff · 4 clocked in · 162h this week · $2,790 weekly payroll estimate"],
  ["Settings",    "7 tabs: Business Info · Elavon Payments · Tax & Receipts · Notifications · Security · Display · Hardware"],
].forEach(([k, v]) => {
  need(14);
  const y = doc.y;
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8.5).text(k + ":", ML, y, { width: 100 });
  doc.fillColor(G500).font("Helvetica").fontSize(8.5).text(v, ML + 108, y, { width: CW - 108 });
  doc.y = y + 14;
});

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 17  — SETTINGS
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("4.12  Settings & Configuration", "Industry mode · Payment terms · Tax rate · App version · Elavon integration");

const sPhW = 118, sPhH = 234;
drawPhone(ML, doc.y, {
  w: sPhW, h: sPhH, caption: "Settings Screen",
  screen: (sx, cy, sw) => screenSettings(sx, cy, sw),
});
const spx = ML + sPhW + 18, spw = CW - sPhW - 18;
const soy = doc.y;

doc.fillColor(G500).font("Helvetica").fontSize(9)
  .text("Settings provides configuration for all mobile app behaviour. Settings persist locally via AsyncStorage and sync relevant values with the Cloud-PoS API. Industry mode changes reconfigure the entire app navigation and feature set without restarting.", spx, soy, { width: spw });

doc.y = soy + sPhH + 12;
rule();

secTitle("Settings Reference");
sp(4);
const sCols = [{ w: 150, label: "Setting" }, { w: 140, label: "Options" }, { w: CW - 290, label: "Description" }];
let setY = doc.y;
setY = tHead(sCols, setY);
[
  ["Industry Mode",     "Restaurant · Retail · Service", "Reconfigures all tabs, labels, and feature availability instantly"],
  ["Payment Terms",     "Net 0/7/15/30/45/60",           "Default applied to new invoices and quotes"],
  ["Tax Rate",          "8.875% (default)",              "Applied at checkout — matches Cloud-PoS server config"],
  ["NFC / Tap to Pay",  "iOS native (entitlement)",      "Uses Apple NFC Tag APDU — reads contactless cards on iPhone"],
  ["Elavon Integration","Converge gateway",              "Credentials set via environment variables on the API server"],
  ["Dark Mode",         "Follows iOS/Android system",   "All screens have full light and dark mode support"],
  ["App Version",       "2.0.0  (Build 3)",              "Build 3 adds Apple NFC entitlement and redesigned reader UI"],
  ["Open Back Office",  "cloudpos.replit.app",           "Opens Cloud-PoS in the system browser for full management"],
].forEach((r, i) => { setY = tRow(sCols, r, setY, i % 2 === 0); });
doc.y = setY + 10;

rule();
secTitle("Server Environment Variables");
sp(4);
const evCols = [{ w: 180, label: "Variable" }, { w: CW - 180, label: "Purpose" }];
let evY = doc.y;
evY = tHead(evCols, evY);
[
  ["DATABASE_URL",         "PostgreSQL connection string (Replit-managed)"],
  ["SESSION_SECRET",       "Express session signing secret"],
  ["RESEND_API_KEY",       "Resend email API key for invoice/quote delivery"],
  ["FROM_EMAIL",           "Sender address for all outbound emails"],
  ["PORTAL_BASE_URL",      "Production URL for payment portal links in emails (set to https://cloud-po-s-wilcoxisaac.replit.app)"],
  ["CONVERGE_MERCHANT_ID", "Elavon/Converge merchant identifier"],
  ["CONVERGE_USER_ID",     "Elavon/Converge API user ID"],
  ["CONVERGE_PIN",         "Elavon/Converge API PIN"],
  ["CONVERGE_ENV",         "'demo' or 'live' — controls payment processing environment"],
].forEach((r, i) => { evY = tRow(evCols, r, evY, i % 2 === 0); });
doc.y = evY + 10;

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 18  — FEATURE COMPARISON MATRIX
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("5. Feature Comparison Matrix", "Cloud POS Mobile vs Cloud-PoS Web — side-by-side capability reference");

para("Side-by-side comparison of all capabilities across the Cloud POS Mobile app and the Cloud-PoS Web back-office. Both share the same API server and PostgreSQL database.");

sp(10);

const mxCols = [{ w: 218, label: "Feature" }, { w: 108, label: "Mobile App" }, { w: 108, label: "Cloud-PoS Web" }, { w: CW - 434, label: "Notes" }];

const matrix = [
  ["SALES & ORDERING",           null, null, null],
  ["Mobile POS / New Order",     "✓", "✓", "Both apps support full order creation"],
  ["Category-filtered menu",     "✓", "✓", "Restaurant, Retail, Service categories"],
  ["Live cart with tax calc",    "✓", "✓", "8.875% default, configurable"],
  ["NFC Tap to Pay (iPhone)",    "✓", "—", "iOS NFC Tag APDU entitlement required"],
  ["Credit / Debit card",        "✓", "✓", "Elavon/Converge gateway integration"],
  ["Cash + change calculation",  "✓", "✓", "Quick-amount shortcuts on mobile"],
  ["Table assignment per order", "✓", "✓", "Synced in real time"],
  ["Tableside ordering",         "✓", "—", "Mobile-exclusive capability"],
  ["Item modifiers & notes",     "✓", "✓", "Modifier sheet on mobile"],
  ["KITCHEN & TABLES",           null, null, null],
  ["Kitchen Display System",     "✓", "✓", "Both mobile and web versions live"],
  ["Table floor plan",           "✓", "✓", "Sections: Main, Bar, Patio, Private"],
  ["Reservation calendar",       "✓", "✓", "Confirm / seat / no-show tracking"],
  ["APPOINTMENTS & INVOICES",    null, null, null],
  ["Appointment scheduling",     "✓", "—", "Service mode, mobile-exclusive"],
  ["Quote creation & sending",   "✓", "—", "Mobile-exclusive document workflow"],
  ["Invoice creation & tracking","✓", "—", "Mobile-exclusive document workflow"],
  ["Email payment portal links", "✓", "—", "Via Resend + PORTAL_BASE_URL"],
  ["Net payment terms",          "✓", "—", "Configurable per invoice/quote"],
  ["CUSTOMERS & LOYALTY",        null, null, null],
  ["Customer profiles (CRM)",    "✓", "✓", "Full CRM on both platforms"],
  ["4-tier loyalty program",     "✓", "✓", "Bronze / Silver / Gold / Platinum"],
  ["Cloud POS sync (one-tap)",   "✓", "—", "Mobile syncs from web CRM"],
  ["Add customer at POS",        "✓", "✓", "During order or standalone"],
  ["ANALYTICS & REPORTING",      null, null, null],
  ["Live KPI dashboard",         "✓ (Back Office)", "✓", "Full analytics on web"],
  ["7-month revenue trend",      "— (Back Office)", "✓", "Web analytics module"],
  ["Export reports",             "— (Back Office)", "✓", "Web analytics module"],
  ["MANAGEMENT",                 null, null, null],
  ["Inventory (SKU-level)",      "— (Back Office)", "✓", "Cost tracking + low/critical alerts"],
  ["Employee management",        "— (Back Office)", "✓", "Clock-in, payroll, sales attribution"],
  ["Menu / Catalog CRUD",        "✓", "✓", "Full product management on both"],
  ["Settings & configuration",   "✓", "✓", "Industry mode synced between apps"],
  ["PLATFORM",                   null, null, null],
  ["Native iOS app",             "✓", "—", "Expo React Native"],
  ["Native Android app",         "✓", "—", "Expo React Native"],
  ["Browser access",             "— (WebView)", "✓", "Any modern browser"],
  ["Dark mode",                  "✓", "—", "System-adaptive on iOS & Android"],
  ["Offline cache / resilience", "✓", "—", "TanStack Query cache layer"],
  ["Haptic feedback",            "✓", "—", "Native iOS/Android haptics"],
  ["Real-time data sync",        "✓", "✓", "Shared PostgreSQL database"],
  ["Always-on hosting",          "✓", "✓", "Replit deployment, no sleep timers"],
];

let mxY = doc.y;
mxY = tHead(mxCols, mxY);
matrix.forEach((row, i) => {
  if (row[1] === null) {
    need(18);
    doc.rect(ML, mxY, CW, 16).fill(NAVY);
    doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(8).text(row[0], ML + 8, mxY + 4, { width: CW - 16 });
    mxY += 16;
  } else {
    need(20);
    mxY = tRow(mxCols, row, mxY, i % 2 === 0);
  }
});
doc.y = mxY + 10;

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE 19  — TECHNICAL REFERENCE
// ═══════════════════════════════════════════════════════════════════════════════
addPage();
pageHeader("6. Technical Architecture & Integration Reference", "Key packages · API endpoints · EAS build configuration");

secTitle("Key npm Packages");
sp(4);
const pkgCols = [{ w: 176, label: "Package" }, { w: 80, label: "Version" }, { w: CW - 256, label: "Purpose" }];
let pkgY = doc.y;
pkgY = tHead(pkgCols, pkgY);
[
  ["expo",                    "~53.0.9",    "Core Expo SDK — native module bridge, dev server, EAS build"],
  ["expo-router",             "~4.0.17",   "File-based URL-driven navigation for React Native"],
  ["@tanstack/react-query",   "^5.74.4",   "Server state — caching, background refresh, optimistic updates"],
  ["react-native-reanimated", "~3.16.7",   "High-performance animations running on the UI thread"],
  ["react-native-nfc-manager","^3.17.2",   "iOS/Android NFC reader — IsoDep Tag APDU for contactless cards"],
  ["expo-haptics",            "~14.0.1",   "Native haptic feedback — impact, selection, notification"],
  ["@expo/vector-icons",      "^14.0.4",   "Feather + Ionicons icon sets"],
  ["expo-font  (Inter)",      "~13.0.4",   "Inter typeface — Regular, Medium, SemiBold, Bold weights"],
  ["drizzle-orm",             "^0.41.0",   "Type-safe PostgreSQL ORM (API server)"],
  ["express",                 "^4.21.2",   "HTTP server framework (API server)"],
  ["resend",                  "^4.1.2",    "Email delivery for invoice and quote portal links"],
].forEach((r, i) => { pkgY = tRow(pkgCols, r, pkgY, i % 2 === 0); });
doc.y = pkgY + 10;

rule();
secTitle("API Endpoint Reference");
sp(4);
const apCols = [{ w: 52, label: "Method" }, { w: 178, label: "Endpoint" }, { w: CW - 230, label: "Description" }];
let epY = doc.y;
epY = tHead(apCols, epY);
const MC = { GET: SUCCESS, POST: BLUE, PATCH: WARN, DELETE: DANGER };
[
  ["GET",   "/api/orders",              "All orders (filterable by status, date, table)"],
  ["POST",  "/api/orders",              "Create new order with items"],
  ["PATCH", "/api/orders/:id",          "Update order items or status"],
  ["POST",  "/api/orders/:id/pay",      "Process payment — updates status, credits loyalty points"],
  ["GET",   "/api/products",            "All menu / catalog items"],
  ["POST",  "/api/products",            "Create product (name, price, category, SKU, emoji)"],
  ["PATCH", "/api/products/:id",        "Update product"],
  ["DELETE","/api/products/:id",        "Remove product"],
  ["GET",   "/api/tables",              "All tables with current status and active order"],
  ["PATCH", "/api/tables/:id",          "Update table status"],
  ["GET",   "/api/kitchen",             "Active kitchen tickets"],
  ["PATCH", "/api/kitchen/:id/status",  "Advance ticket status"],
  ["GET",   "/api/customers",           "Customer list with tier info"],
  ["POST",  "/api/customers/sync",      "Sync from Cloud-PoS — merge points and visit data"],
  ["GET",   "/api/appointments",        "All appointments (filtered by date)"],
  ["POST",  "/api/appointments",        "Create appointment"],
  ["PATCH", "/api/appointments/:id",    "Update status / staff / time"],
  ["GET",   "/api/quotes",              "All quotes with status"],
  ["POST",  "/api/quotes",              "Create quote with line items"],
  ["POST",  "/api/quotes/:id/convert",  "Convert accepted quote to invoice"],
  ["GET",   "/api/invoices",            "All invoices with payment status"],
  ["POST",  "/api/invoices/:id/pay",    "Mark invoice as paid"],
  ["GET",   "/api/settings",            "Business settings (industry, tax rate, etc.)"],
  ["PATCH", "/api/settings",            "Update settings"],
].forEach((r, i) => {
  need(17);
  const y = epY;
  if (i % 2 === 0) doc.rect(ML, y, CW, 16).fill(G50);
  doc.fillColor(MC[r[0]] || G500).font("Helvetica-Bold").fontSize(7).text(r[0], ML + 5, y + 4.5, { width: 44 });
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(7.5).text(r[1], ML + 57, y + 4.5, { width: 170 });
  doc.fillColor(G500).font("Helvetica").fontSize(7.5).text(r[2], ML + 235, y + 4.5, { width: CW - 240 });
  doc.rect(ML, y + 15.5, CW, 0.5).fill(G200);
  epY = y + 16;
});
doc.y = epY + 10;

rule();
secTitle("EAS Build Profiles");
sp(4);
const buildProfiles = [
  { profile: "preview",    type: "APK",  platform: "Android", desc: "Unsigned APK for direct device installation — ideal for staff onboarding and testing. No Play Store required." },
  { profile: "production", type: "AAB",  platform: "Android", desc: "Signed Android App Bundle for Google Play Store submission." },
  { profile: "production", type: "IPA",  platform: "iOS",     desc: "Signed iOS build for App Store or TestFlight distribution. Includes NFC Tag APDU entitlement." },
];
buildProfiles.forEach((b, idx) => {
  need(36);
  const y = doc.y;
  doc.rect(ML, y, CW, 32).fill(idx % 2 === 0 ? G50 : WHITE);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(8.5).text(b.profile, ML + 8, y + 5, { width: 70 });
  doc.rect(ML + 82, y + 4, 32, 13).fill(b.platform === "iOS" ? BLUE : SUCCESS);
  doc.fillColor(WHITE).font("Helvetica-Bold").fontSize(7).text(b.type, ML + 82, y + 7.5, { width: 32, align: "center" });
  doc.fillColor(G500).font("Helvetica").fontSize(7.5).text(b.platform, ML + 120, y + 7.5, { width: 55 });
  doc.fillColor(G500).font("Helvetica").fontSize(8).text(b.desc, ML + 178, y + 5, { width: CW - 186 });
  doc.y = y + 32;
});

sp(10);
doc.rect(ML, doc.y, CW, 22).fill(G100);
doc.rect(ML, doc.y, 3, 22).fill(NAVY);
doc.fillColor(G500).font("Helvetica").fontSize(7.5).text("Build command:", ML + 10, doc.y + 4.5);
doc.fillColor(NAVY).font("Courier").fontSize(8)
  .text("npx eas-cli build -p android --profile preview", ML + 100, doc.y + 4.5, { width: CW - 110 });
doc.y += 26;

sp(10);
doc.fillColor(G400).font("Helvetica").fontSize(8)
  .text("Cloud POS Mobile — Product Capabilities Document  ·  Built by wilcoxisaac on Replit  ·  v2.0.0  ·  March 2026", ML, doc.y, { width: CW, align: "center" });

// ── Close ──────────────────────────────────────────────────────────────────────
doc.end();
stream.on("finish", () => {
  const sz = fs.statSync(OUT).size;
  console.log(`✅  ${path.basename(OUT)}`);
  console.log(`   Pages: ${pageNum}   Size: ${(sz / 1024).toFixed(0)} KB`);
});
stream.on("error", err => { console.error("❌", err); process.exit(1); });
