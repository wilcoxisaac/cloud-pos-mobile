import { db } from "@workspace/db";
import {
  productsTable,
  modifierGroupsTable,
  modifierOptionsTable,
  productModifierGroupsTable,
  categoryModifierGroupsTable,
  restaurantTablesTable,
  ordersTable,
  orderItemsTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const catalog = [
  // Restaurant
  { name: "House Burger",         price: "14.99", category: "Entrees",     industry: "restaurant", sku: "BURG-001", emoji: "🍔", description: "Classic house burger with lettuce, tomato, and special sauce" },
  { name: "Caesar Salad",         price: "11.50", category: "Salads",      industry: "restaurant", sku: "SAL-001",  emoji: "🥗", description: "Romaine, parmesan, house-made Caesar dressing" },
  { name: "Fish & Chips",         price: "17.99", category: "Entrees",     industry: "restaurant", sku: "FISH-001", emoji: "🐟", description: "Beer-battered fish with hand-cut fries" },
  { name: "Margherita Pizza",     price: "16.50", category: "Pizza",       industry: "restaurant", sku: "PIZ-001",  emoji: "🍕", description: "San Marzano tomato, fresh mozzarella, basil" },
  { name: "Craft Beer",           price: "7.00",  category: "Drinks",      industry: "restaurant", sku: "BEV-001",  emoji: "🍺", description: "Rotating selection of local craft beers" },
  { name: "House Wine",           price: "9.00",  category: "Drinks",      industry: "restaurant", sku: "BEV-002",  emoji: "🍷", description: "Red, white, or rosé — ask your server" },
  { name: "Sparkling Water",      price: "3.50",  category: "Drinks",      industry: "restaurant", sku: "BEV-003",  emoji: "💧", description: "500ml bottle of sparkling mineral water" },
  { name: "Tiramisu",             price: "8.00",  category: "Desserts",    industry: "restaurant", sku: "DES-001",  emoji: "🍰", description: "Classic Italian tiramisu with espresso and mascarpone" },
  { name: "Chocolate Lava Cake",  price: "9.50",  category: "Desserts",    industry: "restaurant", sku: "DES-002",  emoji: "🍫", description: "Warm chocolate cake with molten centre" },
  { name: "Coffee",               price: "4.00",  category: "Drinks",      industry: "restaurant", sku: "BEV-004",  emoji: "☕", description: "Espresso-based coffee drinks, oat milk available" },
  // Retail
  { name: "T-Shirt (M)",          price: "24.99", category: "Apparel",     industry: "retail",     sku: "APP-001",  emoji: "👕", description: "100% cotton crew-neck T-shirt, medium" },
  { name: "Denim Jeans",          price: "59.99", category: "Apparel",     industry: "retail",     sku: "APP-002",  emoji: "👖", description: "Classic straight-fit denim jeans" },
  { name: "Sunglasses",           price: "34.99", category: "Accessories", industry: "retail",     sku: "ACC-001",  emoji: "🕶️", description: "UV400 polarised lenses, lightweight frame" },
  { name: "Backpack",             price: "49.99", category: "Accessories", industry: "retail",     sku: "ACC-002",  emoji: "🎒", description: "20L waterproof backpack with laptop sleeve" },
  { name: "Water Bottle",         price: "19.99", category: "Accessories", industry: "retail",     sku: "ACC-003",  emoji: "🧴", description: "Insulated stainless steel 500ml bottle" },
  // Service
  { name: "Haircut",              price: "45.00", category: "Hair",        industry: "service",    sku: "SVC-001",  emoji: "✂️",  description: "Precision cut, wash, and style — 45 min" },
  { name: "Color Treatment",      price: "120.00",category: "Hair",        industry: "service",    sku: "SVC-002",  emoji: "🎨", description: "Full colour treatment with toner — 120 min" },
  { name: "Manicure",             price: "35.00", category: "Nails",       industry: "service",    sku: "SVC-003",  emoji: "💅", description: "Classic manicure with nail shaping and polish" },
  { name: "Massage (60 min)",     price: "90.00", category: "Spa",         industry: "service",    sku: "SVC-004",  emoji: "💆", description: "Full-body relaxation massage — 60 min" },
];

function pad(n: number) { return String(n).padStart(2, "0"); }
function fmtDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function daysAgo(n: number) {
  const d = new Date(); d.setDate(d.getDate() - n); return d;
}
function hoursAgo(h: number) {
  return new Date(Date.now() - h * 3600_000);
}

export async function seedIfEmpty() {
  const existing = await db.select({ id: productsTable.id }).from(productsTable).limit(1);
  if (existing.length > 0) return; // Already seeded

  console.log("[seed] Empty database detected — seeding initial data...");

  // ── Products ─────────────────────────────────────────────────────────
  await db.insert(productsTable).values(catalog.map((p) => ({ ...p, isActive: true })));

  // Update service pricing types
  await db.update(productsTable).set({ pricingType: "hourly", unit: "hr", updatedAt: new Date() }).where(eq(productsTable.sku, "SVC-002"));
  await db.update(productsTable).set({ pricingType: "hourly", unit: "hr", updatedAt: new Date() }).where(eq(productsTable.sku, "SVC-004"));

  // Add brunch bundle
  const [brunchBundle] = await db.insert(productsTable).values({
    name: "Brunch Bundle", description: "Any entrée + coffee + dessert — save $4",
    price: "27.50", category: "Bundles", industry: "restaurant", sku: "BND-001",
    emoji: "🥞", isBundle: true,
    bundleItems: JSON.stringify([{ name: "Any Entrée", quantity: 1 }, { name: "Coffee", quantity: 1 }, { name: "Any Dessert", quantity: 1 }]),
    isActive: true,
  }).returning();

  // ── Modifier Groups ──────────────────────────────────────────────────
  const [cookingTemp] = await db.insert(modifierGroupsTable).values({ name: "Cooking Temperature", description: "How would you like it cooked?", industryContext: "restaurant", selectionType: "single", minSelections: 0, maxSelections: 1, isRequired: false, sortOrder: 1 }).returning();
  await db.insert(modifierOptionsTable).values([
    { groupId: cookingTemp.id, name: "Rare",        priceAdjustment: "0", isDefault: false, sortOrder: 1 },
    { groupId: cookingTemp.id, name: "Medium Rare", priceAdjustment: "0", isDefault: true,  sortOrder: 2 },
    { groupId: cookingTemp.id, name: "Medium",      priceAdjustment: "0", isDefault: false, sortOrder: 3 },
    { groupId: cookingTemp.id, name: "Well Done",   priceAdjustment: "0", isDefault: false, sortOrder: 4 },
  ]);

  const [extras] = await db.insert(modifierGroupsTable).values({ name: "Extra Toppings", description: "Add extra toppings to your order", industryContext: "restaurant", selectionType: "multiple", minSelections: 0, maxSelections: null, isRequired: false, sortOrder: 2 }).returning();
  await db.insert(modifierOptionsTable).values([
    { groupId: extras.id, name: "Extra Cheese",       priceAdjustment: "1.00", isDefault: false, sortOrder: 1 },
    { groupId: extras.id, name: "Bacon",              priceAdjustment: "1.50", isDefault: false, sortOrder: 2 },
    { groupId: extras.id, name: "Mushrooms",          priceAdjustment: "0.75", isDefault: false, sortOrder: 3 },
    { groupId: extras.id, name: "Avocado",            priceAdjustment: "1.25", isDefault: false, sortOrder: 4 },
    { groupId: extras.id, name: "Caramelised Onions", priceAdjustment: "0.50", isDefault: false, sortOrder: 5 },
  ]);

  const [dietary] = await db.insert(modifierGroupsTable).values({ name: "Dietary & Preferences", description: "Dietary restrictions or preferences", industryContext: "restaurant", selectionType: "multiple", minSelections: 0, maxSelections: null, isRequired: false, sortOrder: 3 }).returning();
  await db.insert(modifierOptionsTable).values([
    { groupId: dietary.id, name: "No Onions",   priceAdjustment: "0", isDefault: false, sortOrder: 1 },
    { groupId: dietary.id, name: "No Gluten",   priceAdjustment: "0", isDefault: false, sortOrder: 2 },
    { groupId: dietary.id, name: "Vegan",       priceAdjustment: "0", isDefault: false, sortOrder: 3 },
    { groupId: dietary.id, name: "No Salt",     priceAdjustment: "0", isDefault: false, sortOrder: 4 },
    { groupId: dietary.id, name: "Extra Spicy", priceAdjustment: "0", isDefault: false, sortOrder: 5 },
  ]);

  const [pizzaSize] = await db.insert(modifierGroupsTable).values({ name: "Size", description: "Choose your pizza size", industryContext: "restaurant", selectionType: "single", minSelections: 1, maxSelections: 1, isRequired: true, sortOrder: 0 }).returning();
  await db.insert(modifierOptionsTable).values([
    { groupId: pizzaSize.id, name: 'Personal (8")',  priceAdjustment: "-3.00", isDefault: false, sortOrder: 1 },
    { groupId: pizzaSize.id, name: 'Medium (12")',   priceAdjustment: "0",     isDefault: true,  sortOrder: 2 },
    { groupId: pizzaSize.id, name: 'Large (16")',    priceAdjustment: "4.00",  isDefault: false, sortOrder: 3 },
    { groupId: pizzaSize.id, name: 'Family (18")',   priceAdjustment: "7.00",  isDefault: false, sortOrder: 4 },
  ]);

  const [milkType] = await db.insert(modifierGroupsTable).values({ name: "Milk Type", description: "Choose your milk preference", industryContext: "restaurant", selectionType: "single", minSelections: 0, maxSelections: 1, isRequired: false, sortOrder: 1 }).returning();
  await db.insert(modifierOptionsTable).values([
    { groupId: milkType.id, name: "Full Cream",  priceAdjustment: "0",    isDefault: true,  sortOrder: 1 },
    { groupId: milkType.id, name: "Skim",        priceAdjustment: "0",    isDefault: false, sortOrder: 2 },
    { groupId: milkType.id, name: "Oat Milk",    priceAdjustment: "0.75", isDefault: false, sortOrder: 3 },
    { groupId: milkType.id, name: "Soy Milk",    priceAdjustment: "0.75", isDefault: false, sortOrder: 4 },
    { groupId: milkType.id, name: "Almond Milk", priceAdjustment: "0.75", isDefault: false, sortOrder: 5 },
  ]);

  const [shots] = await db.insert(modifierGroupsTable).values({ name: "Espresso Shots", description: "How many shots?", industryContext: "restaurant", selectionType: "single", minSelections: 0, maxSelections: 1, isRequired: false, sortOrder: 2 }).returning();
  await db.insert(modifierOptionsTable).values([
    { groupId: shots.id, name: "Single", priceAdjustment: "0",    isDefault: false, sortOrder: 1 },
    { groupId: shots.id, name: "Double", priceAdjustment: "0",    isDefault: true,  sortOrder: 2 },
    { groupId: shots.id, name: "Triple", priceAdjustment: "0.50", isDefault: false, sortOrder: 3 },
  ]);

  const [apparelSize] = await db.insert(modifierGroupsTable).values({ name: "Size", description: "Select your size", industryContext: "retail", selectionType: "single", minSelections: 1, maxSelections: 1, isRequired: true, sortOrder: 0 }).returning();
  await db.insert(modifierOptionsTable).values([
    { groupId: apparelSize.id, name: "XS",  priceAdjustment: "0",    isDefault: false, sortOrder: 1 },
    { groupId: apparelSize.id, name: "S",   priceAdjustment: "0",    isDefault: false, sortOrder: 2 },
    { groupId: apparelSize.id, name: "M",   priceAdjustment: "0",    isDefault: true,  sortOrder: 3 },
    { groupId: apparelSize.id, name: "L",   priceAdjustment: "0",    isDefault: false, sortOrder: 4 },
    { groupId: apparelSize.id, name: "XL",  priceAdjustment: "0",    isDefault: false, sortOrder: 5 },
    { groupId: apparelSize.id, name: "XXL", priceAdjustment: "2.00", isDefault: false, sortOrder: 6 },
  ]);

  const [color] = await db.insert(modifierGroupsTable).values({ name: "Color", description: "Select your color", industryContext: "retail", selectionType: "single", minSelections: 1, maxSelections: 1, isRequired: true, sortOrder: 1 }).returning();
  await db.insert(modifierOptionsTable).values([
    { groupId: color.id, name: "Black", priceAdjustment: "0", isDefault: true,  sortOrder: 1 },
    { groupId: color.id, name: "White", priceAdjustment: "0", isDefault: false, sortOrder: 2 },
    { groupId: color.id, name: "Navy",  priceAdjustment: "0", isDefault: false, sortOrder: 3 },
    { groupId: color.id, name: "Grey",  priceAdjustment: "0", isDefault: false, sortOrder: 4 },
    { groupId: color.id, name: "Red",   priceAdjustment: "0", isDefault: false, sortOrder: 5 },
    { groupId: color.id, name: "Olive", priceAdjustment: "0", isDefault: false, sortOrder: 6 },
  ]);

  const [giftWrap] = await db.insert(modifierGroupsTable).values({ name: "Gift Wrap", description: "Add gift wrapping service", industryContext: "retail", selectionType: "single", minSelections: 0, maxSelections: 1, isRequired: false, sortOrder: 5 }).returning();
  await db.insert(modifierOptionsTable).values([
    { groupId: giftWrap.id, name: "No Wrap",       priceAdjustment: "0",    isDefault: true,  sortOrder: 1 },
    { groupId: giftWrap.id, name: "Standard Wrap", priceAdjustment: "3.00", isDefault: false, sortOrder: 2 },
    { groupId: giftWrap.id, name: "Premium Wrap",  priceAdjustment: "6.00", isDefault: false, sortOrder: 3 },
  ]);

  const [svcAddOn] = await db.insert(modifierGroupsTable).values({ name: "Add-ons", description: "Enhance your service with add-ons", industryContext: "service", selectionType: "multiple", minSelections: 0, maxSelections: null, isRequired: false, sortOrder: 2 }).returning();
  await db.insert(modifierOptionsTable).values([
    { groupId: svcAddOn.id, name: "Deep Conditioning Treatment", priceAdjustment: "15.00", isDefault: false, sortOrder: 1 },
    { groupId: svcAddOn.id, name: "Scalp Massage",               priceAdjustment: "10.00", isDefault: false, sortOrder: 2 },
    { groupId: svcAddOn.id, name: "Eyebrow Shaping",             priceAdjustment: "12.00", isDefault: false, sortOrder: 3 },
    { groupId: svcAddOn.id, name: "Hot Oil Treatment",           priceAdjustment: "18.00", isDefault: false, sortOrder: 4 },
  ]);

  const [stylist] = await db.insert(modifierGroupsTable).values({ name: "Stylist Preference", description: "Select your preferred stylist", industryContext: "service", selectionType: "single", minSelections: 0, maxSelections: 1, isRequired: false, sortOrder: 0 }).returning();
  await db.insert(modifierOptionsTable).values([
    { groupId: stylist.id, name: "No Preference",  priceAdjustment: "0",    isDefault: true,  sortOrder: 1 },
    { groupId: stylist.id, name: "Jordan Lee",     priceAdjustment: "0",    isDefault: false, sortOrder: 2 },
    { groupId: stylist.id, name: "Morgan Scott",   priceAdjustment: "0",    isDefault: false, sortOrder: 3 },
    { groupId: stylist.id, name: "Taylor Kim",     priceAdjustment: "5.00", isDefault: false, sortOrder: 4 },
    { groupId: stylist.id, name: "Alex Rivera",    priceAdjustment: "5.00", isDefault: false, sortOrder: 5 },
    { groupId: stylist.id, name: "Jamie Chen",     priceAdjustment: "5.00", isDefault: false, sortOrder: 6 },
  ]);

  // ── Category associations ─────────────────────────────────────────────
  await db.insert(categoryModifierGroupsTable).values([
    { industry: "restaurant", category: "Entrees",     groupId: cookingTemp.id,  sortOrder: 0 },
    { industry: "restaurant", category: "Entrees",     groupId: extras.id,       sortOrder: 1 },
    { industry: "restaurant", category: "Entrees",     groupId: dietary.id,      sortOrder: 2 },
    { industry: "restaurant", category: "Salads",      groupId: dietary.id,      sortOrder: 0 },
    { industry: "restaurant", category: "Pizza",       groupId: pizzaSize.id,    sortOrder: 0 },
    { industry: "restaurant", category: "Pizza",       groupId: extras.id,       sortOrder: 1 },
    { industry: "restaurant", category: "Pizza",       groupId: dietary.id,      sortOrder: 2 },
    { industry: "restaurant", category: "Drinks",      groupId: dietary.id,      sortOrder: 1 },
    { industry: "retail",     category: "Apparel",     groupId: apparelSize.id,  sortOrder: 0 },
    { industry: "retail",     category: "Apparel",     groupId: color.id,        sortOrder: 1 },
    { industry: "retail",     category: "Apparel",     groupId: giftWrap.id,     sortOrder: 2 },
    { industry: "retail",     category: "Accessories", groupId: giftWrap.id,     sortOrder: 0 },
    { industry: "service",    category: "Hair",        groupId: stylist.id,      sortOrder: 0 },
    { industry: "service",    category: "Hair",        groupId: svcAddOn.id,     sortOrder: 1 },
    { industry: "service",    category: "Spa",         groupId: stylist.id,      sortOrder: 0 },
    { industry: "service",    category: "Spa",         groupId: svcAddOn.id,     sortOrder: 1 },
    { industry: "service",    category: "Nails",       groupId: stylist.id,      sortOrder: 0 },
  ]);

  // ── Product-level associations ─────────────────────────────────────────
  const [coffee] = await db.select().from(productsTable).where(eq(productsTable.sku, "BEV-004"));
  if (coffee) {
    await db.insert(productModifierGroupsTable).values([
      { productId: coffee.id, groupId: milkType.id, sortOrder: 0 },
      { productId: coffee.id, groupId: shots.id,    sortOrder: 1 },
    ]);
  }

  const [burger] = await db.select().from(productsTable).where(eq(productsTable.sku, "BURG-001"));
  if (burger) {
    await db.insert(productModifierGroupsTable).values([{ productId: burger.id, groupId: cookingTemp.id, sortOrder: 0 }]);
  }

  if (brunchBundle) {
    await db.insert(productModifierGroupsTable).values([{ productId: brunchBundle.id, groupId: dietary.id, sortOrder: 0 }]);
  }

  // ── Restaurant tables (floor plan) ────────────────────────────────────
  await db.insert(restaurantTablesTable).values([
    { name: "T1", capacity: 2, section: "Main",  status: "available" },
    { name: "T2", capacity: 4, section: "Main",  status: "available" },
    { name: "T3", capacity: 4, section: "Main",  status: "available" },
    { name: "T4", capacity: 6, section: "Main",  status: "available" },
    { name: "T5", capacity: 6, section: "Main",  status: "available" },
    { name: "T6", capacity: 8, section: "Main",  status: "available" },
    { name: "B1", capacity: 2, section: "Bar",   status: "available" },
    { name: "B2", capacity: 2, section: "Bar",   status: "available" },
    { name: "B3", capacity: 4, section: "Bar",   status: "available" },
    { name: "P1", capacity: 4, section: "Patio", status: "available" },
    { name: "P2", capacity: 6, section: "Patio", status: "available" },
    { name: "P3", capacity: 8, section: "Patio", status: "available" },
  ]);

  // ── Default app settings ──────────────────────────────────────────────
  await db.execute(sql`
    INSERT INTO app_settings (key, value) VALUES ('industry', 'restaurant')
    ON CONFLICT (key) DO NOTHING
  `);

  // ── Historical orders (past 30 days) ──────────────────────────────────
  const products = await db.select().from(productsTable);
  const bySkuMap = new Map(products.map(p => [p.sku, p]));

  const historicalTemplates = [
    // Restaurant orders
    { items: [{ sku: "BURG-001", qty: 2 }, { sku: "BEV-001", qty: 2 }], method: "card" as const, table: "T2", guests: 2 },
    { items: [{ sku: "PIZ-001", qty: 1 }, { sku: "BEV-002", qty: 2 }, { sku: "DES-001", qty: 1 }], method: "card" as const, table: "T4", guests: 3 },
    { items: [{ sku: "FISH-001", qty: 2 }, { sku: "SAL-001", qty: 1 }, { sku: "BEV-003", qty: 3 }], method: "cash" as const, table: "T5", guests: 3 },
    { items: [{ sku: "BURG-001", qty: 1 }, { sku: "SAL-001", qty: 1 }, { sku: "BEV-004", qty: 2 }], method: "card" as const, table: "B2", guests: 2 },
    { items: [{ sku: "BURG-001", qty: 3 }, { sku: "BEV-001", qty: 3 }, { sku: "DES-002", qty: 2 }], method: "card" as const, table: "T6", guests: 4 },
    { items: [{ sku: "PIZ-001", qty: 2 }, { sku: "BEV-002", qty: 2 }], method: "cash" as const, table: "T3", guests: 4 },
    { items: [{ sku: "BND-001", qty: 2 }, { sku: "BEV-004", qty: 2 }], method: "card" as const, table: "P1", guests: 2 },
    // Retail orders
    { items: [{ sku: "APP-001", qty: 2 }, { sku: "ACC-003", qty: 1 }], method: "card" as const },
    { items: [{ sku: "APP-002", qty: 1 }], method: "cash" as const },
    { items: [{ sku: "ACC-001", qty: 1 }, { sku: "ACC-002", qty: 1 }], method: "card" as const },
    { items: [{ sku: "APP-001", qty: 3 }, { sku: "ACC-003", qty: 2 }], method: "card" as const },
    // Service orders
    { items: [{ sku: "SVC-001", qty: 1 }], method: "card" as const, customer: "Emma Wilson" },
    { items: [{ sku: "SVC-002", qty: 1 }], method: "card" as const, customer: "Maria Torres" },
    { items: [{ sku: "SVC-003", qty: 1 }], method: "cash" as const, customer: "Lisa Park" },
    { items: [{ sku: "SVC-004", qty: 1 }], method: "card" as const, customer: "Rachel Brown" },
    { items: [{ sku: "SVC-001", qty: 1 }, { sku: "SVC-003", qty: 1 }], method: "card" as const, customer: "Tanya Patel" },
  ];

  const TAX_RATE = 0.08875;
  let orderNum = 1000;

  for (let d = 30; d >= 1; d--) {
    const day = daysAgo(d);
    const dayStr = fmtDate(day);

    // Pick 4-8 templates randomly (deterministic by day)
    const seed = d * 7;
    const count = 4 + (seed % 5);
    const indices = Array.from({ length: count }, (_, i) => (seed + i * 3) % historicalTemplates.length);

    for (const idx of indices) {
      const tpl = historicalTemplates[idx];
      let subtotal = 0;
      const lineItems: Array<{ sku: string; name: string; price: string; qty: number; lineTotal: number }> = [];

      for (const line of tpl.items) {
        const product = bySkuMap.get(line.sku);
        if (!product) continue;
        const lineTotal = parseFloat(product.price) * line.qty;
        subtotal += lineTotal;
        lineItems.push({ sku: line.sku, name: product.name, price: product.price, qty: line.qty, lineTotal });
      }

      const tax = subtotal * TAX_RATE;
      const total = subtotal + tax;
      const amountTendered = tpl.method === "cash" ? Math.ceil(total / 5) * 5 : total;
      const changeDue = tpl.method === "cash" ? amountTendered - total : 0;
      const paidAt = new Date(day); paidAt.setHours(12 + (seed % 10), (seed * 7) % 60);

      orderNum++;
      const orderNumberStr = `ORD-${orderNum}`;

      const [order] = await db.insert(ordersTable).values({
        orderNumber: orderNumberStr,
        status: "paid",
        subtotal: subtotal.toFixed(2),
        tax: tax.toFixed(2),
        total: total.toFixed(2),
        paymentMethod: tpl.method,
        amountTendered: amountTendered.toFixed(2),
        changeDue: changeDue.toFixed(2),
        tableNumber: tpl.table ?? null,
        guestCount: tpl.guests ?? null,
        customerName: tpl.customer ?? null,
        kitchenStatus: "served",
        createdAt: paidAt,
        updatedAt: paidAt,
        paidAt,
      }).returning();

      for (const line of lineItems) {
        const product = bySkuMap.get(line.sku)!;
        await db.insert(orderItemsTable).values({
          orderId: order.id,
          productId: product.id,
          productName: line.name,
          productPrice: line.price,
          quantity: line.qty,
          subtotal: line.lineTotal.toFixed(2),
        });
      }
    }

    console.log(`[seed] Seeded orders for ${dayStr}`);
  }

  console.log(`[seed] Done — seeded ${catalog.length + 1} products, 11 modifier groups, 12 tables, and 30 days of orders`);
}
