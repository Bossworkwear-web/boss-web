#!/usr/bin/env node
/**
 * Ensure JB cross-back apron straps are storefront-visible for Order Together:
 * - Unhide 5ACPS
 * - Create 5ACBY if missing (not in reseller XLSX; live on jbswear.com.au)
 *
 * Usage: node scripts/ensure-jb-apron-straps.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  const { data: acps, error: acpsErr } = await supabase
    .from("products")
    .update({ storefront_hidden: false })
    .eq("slug", "jb-5acps")
    .select("id, slug, storefront_hidden")
    .maybeSingle();
  if (acpsErr) throw acpsErr;
  console.log("5ACPS unhide:", acps ?? "(not found)");

  const { data: existing } = await supabase
    .from("products")
    .select("id, slug")
    .eq("slug", "jb-5acby")
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase
      .from("products")
      .update({ storefront_hidden: false, is_active: true })
      .eq("id", existing.id);
    if (error) throw error;
    console.log("5ACBY already exists; ensured visible:", existing.id);
    return;
  }

  // Reseller workbook lacks 5ACBY; price sits between 5ACBS ($1.50) and 5ACPS ($2.50).
  const row = {
    name: "JB's Wear JB's CHANGEABLE YARN DYED CROSS BACK APRON STRAP (5ACBY)",
    slug: "jb-5acby",
    supplier_name: "JB's Wear",
    category: "T-shirts",
    base_price: 2,
    sale_price: null,
    is_active: true,
    storefront_hidden: false,
    available_colors: ["Chocolate/Latte"],
    available_sizes: ["130X3"],
    image_urls: [
      "https://www.jbswear.com.au/ClientData/ClientImages/Colours/5ACBY_HK_01%20copy_637091561605947566.jpg#jbpc=1",
      "https://www.jbswear.com.au/ClientData/ClientImages/Products/5ACBY_HK_01%20copy_637091561605947566_639167804891133366.jpg",
    ],
    description:
      "Create your own look with these changeable coloured straps\n\n- 100% polyester herringbone\n- Clean finish with button hole to attach on apron\n- Strap size: 3cm (W) x 130cm (L)\n- Apron sold separately\n- Two Straps per pack\n\nMore info: https://www.jbswear.com.au/product-detail/-in-product/5ACBY",
  };

  const { data: inserted, error: insertErr } = await supabase
    .from("products")
    .insert(row)
    .select("id, slug, name")
    .single();
  if (insertErr) throw insertErr;
  console.log("Created 5ACBY:", inserted);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
