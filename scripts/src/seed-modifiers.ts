import {
  db,
  productsTable,
  modifierGroupsTable,
  modifierOptionsTable,
  productModifierGroupsTable,
  categoryModifierGroupsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

async function seed() {
  console.log("Seeding modifier groups...");

  // Clear existing modifier data
  await db.execute(sql`TRUNCATE TABLE category_modifier_groups, product_modifier_groups, modifier_options, modifier_groups RESTART IDENTITY CASCADE`);

  // ─── RESTAURANT modifier groups ─────────────────────────────────────
  const [cookingTemp] = await db.insert(modifierGroupsTable).values({
    name: "Cooking Temperature",
    description: "How would you like it cooked?",
    industryContext: "restaurant",
    selectionType: "single",
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    sortOrder: 1,
  }).returning();

  await db.insert(modifierOptionsTable).values([
    { groupId: cookingTemp.id, name: "Rare",        priceAdjustment: "0", isDefault: false, sortOrder: 1 },
    { groupId: cookingTemp.id, name: "Medium Rare", priceAdjustment: "0", isDefault: true,  sortOrder: 2 },
    { groupId: cookingTemp.id, name: "Medium",      priceAdjustment: "0", isDefault: false, sortOrder: 3 },
    { groupId: cookingTemp.id, name: "Well Done",   priceAdjustment: "0", isDefault: false, sortOrder: 4 },
  ]);

  const [extras] = await db.insert(modifierGroupsTable).values({
    name: "Extra Toppings",
    description: "Add extra toppings to your order",
    industryContext: "restaurant",
    selectionType: "multiple",
    minSelections: 0,
    maxSelections: null,
    isRequired: false,
    sortOrder: 2,
  }).returning();

  await db.insert(modifierOptionsTable).values([
    { groupId: extras.id, name: "Extra Cheese",  priceAdjustment: "1.00", isDefault: false, sortOrder: 1 },
    { groupId: extras.id, name: "Bacon",         priceAdjustment: "1.50", isDefault: false, sortOrder: 2 },
    { groupId: extras.id, name: "Mushrooms",     priceAdjustment: "0.75", isDefault: false, sortOrder: 3 },
    { groupId: extras.id, name: "Avocado",       priceAdjustment: "1.25", isDefault: false, sortOrder: 4 },
    { groupId: extras.id, name: "Caramelised Onions", priceAdjustment: "0.50", isDefault: false, sortOrder: 5 },
  ]);

  const [dietary] = await db.insert(modifierGroupsTable).values({
    name: "Dietary & Preferences",
    description: "Dietary restrictions or preferences",
    industryContext: "restaurant",
    selectionType: "multiple",
    minSelections: 0,
    maxSelections: null,
    isRequired: false,
    sortOrder: 3,
  }).returning();

  await db.insert(modifierOptionsTable).values([
    { groupId: dietary.id, name: "No Onions",  priceAdjustment: "0", isDefault: false, sortOrder: 1 },
    { groupId: dietary.id, name: "No Gluten",  priceAdjustment: "0", isDefault: false, sortOrder: 2 },
    { groupId: dietary.id, name: "Vegan",      priceAdjustment: "0", isDefault: false, sortOrder: 3 },
    { groupId: dietary.id, name: "No Salt",    priceAdjustment: "0", isDefault: false, sortOrder: 4 },
    { groupId: dietary.id, name: "Extra Spicy",priceAdjustment: "0", isDefault: false, sortOrder: 5 },
  ]);

  const [pizzaSize] = await db.insert(modifierGroupsTable).values({
    name: "Size",
    description: "Choose your pizza size",
    industryContext: "restaurant",
    selectionType: "single",
    minSelections: 1,
    maxSelections: 1,
    isRequired: true,
    sortOrder: 0,
  }).returning();

  await db.insert(modifierOptionsTable).values([
    { groupId: pizzaSize.id, name: "Personal (8\")",  priceAdjustment: "-3.00", isDefault: false, sortOrder: 1 },
    { groupId: pizzaSize.id, name: "Medium (12\")",   priceAdjustment: "0",     isDefault: true,  sortOrder: 2 },
    { groupId: pizzaSize.id, name: "Large (16\")",    priceAdjustment: "4.00",  isDefault: false, sortOrder: 3 },
    { groupId: pizzaSize.id, name: "Family (18\")",   priceAdjustment: "7.00",  isDefault: false, sortOrder: 4 },
  ]);

  const [milkType] = await db.insert(modifierGroupsTable).values({
    name: "Milk Type",
    description: "Choose your milk preference",
    industryContext: "restaurant",
    selectionType: "single",
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    sortOrder: 1,
  }).returning();

  await db.insert(modifierOptionsTable).values([
    { groupId: milkType.id, name: "Full Cream",  priceAdjustment: "0",    isDefault: true,  sortOrder: 1 },
    { groupId: milkType.id, name: "Skim",        priceAdjustment: "0",    isDefault: false, sortOrder: 2 },
    { groupId: milkType.id, name: "Oat Milk",    priceAdjustment: "0.75", isDefault: false, sortOrder: 3 },
    { groupId: milkType.id, name: "Soy Milk",    priceAdjustment: "0.75", isDefault: false, sortOrder: 4 },
    { groupId: milkType.id, name: "Almond Milk", priceAdjustment: "0.75", isDefault: false, sortOrder: 5 },
  ]);

  const [shots] = await db.insert(modifierGroupsTable).values({
    name: "Espresso Shots",
    description: "How many shots?",
    industryContext: "restaurant",
    selectionType: "single",
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    sortOrder: 2,
  }).returning();

  await db.insert(modifierOptionsTable).values([
    { groupId: shots.id, name: "Single",  priceAdjustment: "0",    isDefault: false, sortOrder: 1 },
    { groupId: shots.id, name: "Double",  priceAdjustment: "0",    isDefault: true,  sortOrder: 2 },
    { groupId: shots.id, name: "Triple",  priceAdjustment: "0.50", isDefault: false, sortOrder: 3 },
  ]);

  // ─── RETAIL modifier groups ──────────────────────────────────────────
  const [apparelSize] = await db.insert(modifierGroupsTable).values({
    name: "Size",
    description: "Select your size",
    industryContext: "retail",
    selectionType: "single",
    minSelections: 1,
    maxSelections: 1,
    isRequired: true,
    sortOrder: 0,
  }).returning();

  await db.insert(modifierOptionsTable).values([
    { groupId: apparelSize.id, name: "XS",  priceAdjustment: "0", isDefault: false, sortOrder: 1 },
    { groupId: apparelSize.id, name: "S",   priceAdjustment: "0", isDefault: false, sortOrder: 2 },
    { groupId: apparelSize.id, name: "M",   priceAdjustment: "0", isDefault: true,  sortOrder: 3 },
    { groupId: apparelSize.id, name: "L",   priceAdjustment: "0", isDefault: false, sortOrder: 4 },
    { groupId: apparelSize.id, name: "XL",  priceAdjustment: "0", isDefault: false, sortOrder: 5 },
    { groupId: apparelSize.id, name: "XXL", priceAdjustment: "2.00", isDefault: false, sortOrder: 6 },
  ]);

  const [color] = await db.insert(modifierGroupsTable).values({
    name: "Color",
    description: "Select your color",
    industryContext: "retail",
    selectionType: "single",
    minSelections: 1,
    maxSelections: 1,
    isRequired: true,
    sortOrder: 1,
  }).returning();

  await db.insert(modifierOptionsTable).values([
    { groupId: color.id, name: "Black",   priceAdjustment: "0", isDefault: true,  sortOrder: 1 },
    { groupId: color.id, name: "White",   priceAdjustment: "0", isDefault: false, sortOrder: 2 },
    { groupId: color.id, name: "Navy",    priceAdjustment: "0", isDefault: false, sortOrder: 3 },
    { groupId: color.id, name: "Grey",    priceAdjustment: "0", isDefault: false, sortOrder: 4 },
    { groupId: color.id, name: "Red",     priceAdjustment: "0", isDefault: false, sortOrder: 5 },
    { groupId: color.id, name: "Olive",   priceAdjustment: "0", isDefault: false, sortOrder: 6 },
  ]);

  const [giftWrap] = await db.insert(modifierGroupsTable).values({
    name: "Gift Wrap",
    description: "Add gift wrapping service",
    industryContext: "retail",
    selectionType: "single",
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    sortOrder: 5,
  }).returning();

  await db.insert(modifierOptionsTable).values([
    { groupId: giftWrap.id, name: "No Wrap",       priceAdjustment: "0",    isDefault: true,  sortOrder: 1 },
    { groupId: giftWrap.id, name: "Standard Wrap", priceAdjustment: "3.00", isDefault: false, sortOrder: 2 },
    { groupId: giftWrap.id, name: "Premium Wrap",  priceAdjustment: "6.00", isDefault: false, sortOrder: 3 },
  ]);

  // ─── SERVICE modifier groups ─────────────────────────────────────────
  const [svcAddOn] = await db.insert(modifierGroupsTable).values({
    name: "Add-ons",
    description: "Enhance your service with add-ons",
    industryContext: "service",
    selectionType: "multiple",
    minSelections: 0,
    maxSelections: null,
    isRequired: false,
    sortOrder: 2,
  }).returning();

  await db.insert(modifierOptionsTable).values([
    { groupId: svcAddOn.id, name: "Deep Conditioning Treatment", priceAdjustment: "15.00", isDefault: false, sortOrder: 1 },
    { groupId: svcAddOn.id, name: "Scalp Massage",               priceAdjustment: "10.00", isDefault: false, sortOrder: 2 },
    { groupId: svcAddOn.id, name: "Eyebrow Shaping",             priceAdjustment: "12.00", isDefault: false, sortOrder: 3 },
    { groupId: svcAddOn.id, name: "Hot Oil Treatment",           priceAdjustment: "18.00", isDefault: false, sortOrder: 4 },
  ]);

  const [stylist] = await db.insert(modifierGroupsTable).values({
    name: "Stylist Preference",
    description: "Select your preferred stylist",
    industryContext: "service",
    selectionType: "single",
    minSelections: 0,
    maxSelections: 1,
    isRequired: false,
    sortOrder: 0,
  }).returning();

  await db.insert(modifierOptionsTable).values([
    { groupId: stylist.id, name: "No Preference",  priceAdjustment: "0",    isDefault: true,  sortOrder: 1 },
    { groupId: stylist.id, name: "Jordan Lee",     priceAdjustment: "0",    isDefault: false, sortOrder: 2 },
    { groupId: stylist.id, name: "Morgan Scott",   priceAdjustment: "0",    isDefault: false, sortOrder: 3 },
    { groupId: stylist.id, name: "Taylor Kim",     priceAdjustment: "5.00", isDefault: false, sortOrder: 4 },
    { groupId: stylist.id, name: "Alex Rivera",    priceAdjustment: "5.00", isDefault: false, sortOrder: 5 },
    { groupId: stylist.id, name: "Jamie Chen",     priceAdjustment: "5.00", isDefault: false, sortOrder: 6 },
  ]);

  // ─── Category-level associations ─────────────────────────────────────
  // Restaurant: Entrees get cooking temp, extras, dietary
  await db.insert(categoryModifierGroupsTable).values([
    { industry: "restaurant", category: "Entrees",  groupId: cookingTemp.id, sortOrder: 0 },
    { industry: "restaurant", category: "Entrees",  groupId: extras.id,      sortOrder: 1 },
    { industry: "restaurant", category: "Entrees",  groupId: dietary.id,     sortOrder: 2 },
    { industry: "restaurant", category: "Salads",   groupId: dietary.id,     sortOrder: 0 },
    { industry: "restaurant", category: "Pizza",    groupId: pizzaSize.id,   sortOrder: 0 },
    { industry: "restaurant", category: "Pizza",    groupId: extras.id,      sortOrder: 1 },
    { industry: "restaurant", category: "Pizza",    groupId: dietary.id,     sortOrder: 2 },
    { industry: "restaurant", category: "Drinks",   groupId: dietary.id,     sortOrder: 1 },
    // Retail: Apparel gets size + color + gift wrap
    { industry: "retail",     category: "Apparel",     groupId: apparelSize.id, sortOrder: 0 },
    { industry: "retail",     category: "Apparel",     groupId: color.id,       sortOrder: 1 },
    { industry: "retail",     category: "Apparel",     groupId: giftWrap.id,    sortOrder: 2 },
    { industry: "retail",     category: "Accessories", groupId: giftWrap.id,    sortOrder: 0 },
    // Service: All categories get stylist preference + add-ons
    { industry: "service",    category: "Hair", groupId: stylist.id,  sortOrder: 0 },
    { industry: "service",    category: "Hair", groupId: svcAddOn.id, sortOrder: 1 },
    { industry: "service",    category: "Spa",  groupId: stylist.id,  sortOrder: 0 },
    { industry: "service",    category: "Spa",  groupId: svcAddOn.id, sortOrder: 1 },
    { industry: "service",    category: "Nails", groupId: stylist.id, sortOrder: 0 },
  ]);

  // ─── Product-level associations ───────────────────────────────────────
  // Coffee gets milk type + espresso shots
  const coffeeProduct = await db.select().from(productsTable).where(and(eq(productsTable.sku, "BEV-004"), eq(productsTable.isActive, true)));
  if (coffeeProduct.length > 0) {
    await db.insert(productModifierGroupsTable).values([
      { productId: coffeeProduct[0].id, groupId: milkType.id, sortOrder: 0 },
      { productId: coffeeProduct[0].id, groupId: shots.id,    sortOrder: 1 },
    ]);
  }

  // Burger also gets cooking temp (product level to ensure it's there)
  const burgerProduct = await db.select().from(productsTable).where(and(eq(productsTable.sku, "BURG-001"), eq(productsTable.isActive, true)));
  if (burgerProduct.length > 0) {
    await db.insert(productModifierGroupsTable).values([
      { productId: burgerProduct[0].id, groupId: cookingTemp.id, sortOrder: 0 },
    ]);
  }

  // ─── Update service products with pricing types ───────────────────────
  // Color Treatment and Massage → hourly pricing
  await db.update(productsTable)
    .set({ pricingType: "hourly", unit: "hr", updatedAt: new Date() })
    .where(eq(productsTable.sku, "SVC-002")); // Color Treatment

  await db.update(productsTable)
    .set({ pricingType: "hourly", unit: "hr", updatedAt: new Date() })
    .where(eq(productsTable.sku, "SVC-004")); // Massage

  // Haircut and Manicure → fixed
  await db.update(productsTable)
    .set({ pricingType: "fixed", updatedAt: new Date() })
    .where(eq(productsTable.sku, "SVC-001"));

  await db.update(productsTable)
    .set({ pricingType: "fixed", updatedAt: new Date() })
    .where(eq(productsTable.sku, "SVC-003"));

  // ─── Add restaurant bundle: Weekend Brunch Bundle ─────────────────────
  const [brunchBundle] = await db.insert(productsTable).values({
    name: "Brunch Bundle",
    description: "Any entrée + coffee + dessert — save $4",
    price: "27.50",
    category: "Bundles",
    industry: "restaurant",
    sku: "BND-001",
    emoji: "🥞",
    isBundle: true,
    bundleItems: JSON.stringify([
      { name: "Any Entrée", quantity: 1 },
      { name: "Coffee", quantity: 1 },
      { name: "Any Dessert", quantity: 1 },
    ]),
    isActive: true,
  }).returning();

  // Bundle gets dietary modifier
  await db.insert(productModifierGroupsTable).values([
    { productId: brunchBundle.id, groupId: dietary.id, sortOrder: 0 },
  ]);

  console.log("✓ Modifier groups seeded:");
  const groups = await db.select().from(modifierGroupsTable);
  for (const g of groups) {
    const opts = await db.select().from(modifierOptionsTable).where(eq(modifierOptionsTable.groupId, g.id));
    console.log(`  [${g.industryContext}] ${g.name} (${g.selectionType}, ${opts.length} options)`);
  }

  console.log("\n✓ Category associations seeded");
  console.log("✓ Service pricing types updated");
  console.log("✓ Restaurant bundle added");

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
