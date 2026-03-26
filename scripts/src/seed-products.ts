import { db, productsTable } from "@workspace/db";
import { sql } from "drizzle-orm";

const backOfficeCatalog = [
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

  // Service (back office calls this "services")
  { name: "Haircut",              price: "45.00", category: "Hair",        industry: "service",    sku: "SVC-001",  emoji: "✂️", description: "Precision cut, wash, and style — 45 min" },
  { name: "Color Treatment",      price: "120.00",category: "Hair",        industry: "service",    sku: "SVC-002",  emoji: "🎨", description: "Full colour treatment with toner — 120 min" },
  { name: "Manicure",             price: "35.00", category: "Nails",       industry: "service",    sku: "SVC-003",  emoji: "💅", description: "Classic manicure with nail shaping and polish" },
  { name: "Massage (60 min)",     price: "90.00", category: "Spa",         industry: "service",    sku: "SVC-004",  emoji: "💆", description: "Full-body relaxation massage — 60 min" },
];

async function seed() {
  console.log("Clearing existing products...");
  await db.execute(sql`TRUNCATE TABLE products RESTART IDENTITY CASCADE`);

  console.log(`Inserting ${backOfficeCatalog.length} products...`);
  await db.insert(productsTable).values(
    backOfficeCatalog.map((p) => ({
      ...p,
      isActive: true,
    }))
  );

  const rows = await db.select().from(productsTable);
  console.log(`Done. Total products in DB: ${rows.length}`);
  for (const r of rows) {
    console.log(`  [${r.industry}] ${r.emoji} ${r.name} — $${r.price} (${r.category})`);
  }
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
