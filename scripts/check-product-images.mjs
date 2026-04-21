/**
 * Check if products table has image_urls column and what data exists.
 * Run: node scripts/check-product-images.mjs
 * (Ensure .env.local is loaded or env vars are set)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = join(__dirname, "..", ".env.local");
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const eq = trimmed.indexOf("=");
        if (eq > 0) {
          const key = trimmed.slice(0, eq).trim();
          let val = trimmed.slice(eq + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          process.env[key] = val;
        }
      }
    }
  }
}

loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase env vars (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY).");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log("=== Products table - image check ===\n");

  // 1. Get one row with * to see all columns
  const { data: sample, error: sampleError } = await supabase
    .from("products")
    .select("*")
    .limit(1);

  if (sampleError) {
    console.error("Error fetching products:", sampleError.message);
    process.exit(1);
  }

  if (!sample || sample.length === 0) {
    console.log("No products in table.");
    return;
  }

  const columns = Object.keys(sample[0]);
  console.log("Columns in products table:", columns.join(", "));
  console.log("Has 'image_urls' column:", columns.includes("image_urls"));
  console.log("");

  // 2. Try to select image_urls explicitly
  const { data: withImages, error: imgError } = await supabase
    .from("products")
    .select("id, name, image_urls")
    .limit(10);

  if (imgError) {
    console.log("Error when selecting image_urls:", imgError.message);
    console.log("(This usually means the column does not exist)\n");
  } else {
    console.log("Sample products with image_urls (first 10):");
    console.log(JSON.stringify(withImages, null, 2));
  }

  // 3. Count how many have non-empty image_urls
  if (!imgError && withImages) {
    const withImg = withImages.filter((p) => p.image_urls && Array.isArray(p.image_urls) && p.image_urls.length > 0);
    const total = withImages.length;
    console.log(`\nOf ${total} sampled: ${withImg.length} have at least one image URL.`);
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
