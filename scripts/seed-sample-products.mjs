import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase env vars.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SUB_CATEGORIES = [
  { slug: "t-shirts", label: "T-shirts" },
  { slug: "polos", label: "Polos" },
  { slug: "shirts", label: "Shirts" },
  { slug: "jackets", label: "Jackets" },
  { slug: "pants", label: "Pants" },
  { slug: "scrubs", label: "Scrubs" },
  { slug: "chef", label: "Chef" },
  { slug: "boots", label: "Boots" },
  { slug: "glove", label: "Glove" },
  { slug: "safty-glasses", label: "Safty Glasses" },
  { slug: "hi-vis-vest", label: "Hi-vis Vest" },
];

const SAMPLE_PREFIX = "[SAMPLE]";

async function getProductColumns() {
  const { data, error } = await supabase
    .from("products")
    .select("*")
    .limit(1);

  if (error) {
    throw new Error(`Could not inspect products table columns: ${error.message}`);
  }

  if (!data || data.length === 0) {
    // Fallback when table is empty: include common optional columns.
    return new Set(["name", "slug", "category", "description", "base_price", "weight_kg"]);
  }

  return new Set(Object.keys(data[0]));
}

async function run() {
  const productColumns = await getProductColumns();
  const rows = [];

  SUB_CATEGORIES.forEach((sub) => {
    for (let i = 1; i <= 10; i += 1) {
      const padded = String(i).padStart(2, "0");
      const name = `${SAMPLE_PREFIX} ${sub.label} ${padded}`;
      const row = {
        name,
        base_price: 20 + i,
        weight_kg: Number((0.2 + i * 0.01).toFixed(3)),
      };

      if (productColumns.has("slug")) {
        row.slug = `sample-${sub.slug}-${padded}`;
      }
      if (productColumns.has("category")) {
        row.category = sub.label;
      }
      if (productColumns.has("description")) {
        row.description = `${SAMPLE_PREFIX} ${sub.label} seed data. Safe to delete.`;
      }

      rows.push(row);
    }
  });

  const { error } = await supabase.from("products").insert(rows);

  if (error) {
    console.error("Failed to seed sample products.", error.message);
    process.exit(1);
  }

  console.log(`Seeded ${rows.length} sample products.`);
}

run().catch((error) => {
  console.error("Unexpected failure while seeding sample products.", error);
  process.exit(1);
});
