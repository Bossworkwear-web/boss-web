/**
 * Removes rows created by `npm run seed:sample-products`:
 * - name starts with "[SAMPLE] " (see seed-sample-products.mjs)
 * - or slug matches /^sample-/i
 * - or exact name in EXTRA_DELETE_EXACT_NAMES (e.g. one-off test rows)
 *
 * Needs a key that can delete rows (recommended: SUPABASE_SERVICE_ROLE_KEY).
 * Anon key often has no DELETE policy on `products` — deletes will fail with a clear error.
 *
 * Run: npm run clear:sample-products
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

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
  console.error("Missing Supabase env vars.");
  process.exit(1);
}

const usingServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const SAMPLE_NAME_PREFIX = "[SAMPLE] ";

const EXTRA_DELETE_EXACT_NAMES = new Set(["Weight Test Product"]);

function shouldDeleteRow(row) {
  const name = row.name ?? "";
  const slug = row.slug ?? "";
  if (EXTRA_DELETE_EXACT_NAMES.has(name)) {
    return true;
  }
  return name.startsWith(SAMPLE_NAME_PREFIX) || /^sample-/i.test(String(slug));
}

async function run() {
  if (!usingServiceRole) {
    console.warn(
      "Tip: Set SUPABASE_SERVICE_ROLE_KEY in .env.local so deletes are allowed (RLS usually blocks anon DELETE on products).",
    );
  }

  const { data: rows, error: readError } = await supabase.from("products").select("id,name,slug");

  if (readError) {
    console.error("Failed to list products:", readError.message);
    process.exit(1);
  }

  const sampleIds = (rows ?? []).filter(shouldDeleteRow).map((r) => r.id);

  if (sampleIds.length === 0) {
    console.log("No matching products to delete.");
    return;
  }

  const chunkSize = 200;
  let deleted = 0;
  for (let i = 0; i < sampleIds.length; i += chunkSize) {
    const chunk = sampleIds.slice(i, i + chunkSize);
    const { error: delError } = await supabase.from("products").delete().in("id", chunk);
    if (delError) {
      console.error("Delete failed:", delError.message);
      process.exit(1);
    }
    deleted += chunk.length;
  }

  console.log(`Deleted ${deleted} product(s) (samples + configured test names).`);
}

run().catch((error) => {
  console.error("Unexpected failure while clearing sample products.", error);
  process.exit(1);
});
