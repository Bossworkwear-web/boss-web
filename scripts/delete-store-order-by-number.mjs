#!/usr/bin/env node
/**
 * Delete one storefront order by order_number (e.g. BOS_20260516_001).
 * Usage: node scripts/delete-store-order-by-number.mjs BOS_20260516_001
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

const orderNumber = (process.argv[2] ?? "").trim();
if (!orderNumber) {
  console.error("Usage: node scripts/delete-store-order-by-number.mjs <ORDER_NUMBER>");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CLICK_UP_BUCKET = "click-up-sheet-images";
const PRODUCTION_ASSETS = "production_order_assets";

async function deleteClickUpImages(customerOrderId) {
  const { data: rows, error } = await supabase
    .from("click_up_sheet_images")
    .select("storage_path")
    .eq("customer_order_id", customerOrderId);
  if (error) return;
  const paths = (rows ?? []).map((r) => (r.storage_path ?? "").trim()).filter(Boolean);
  if (paths.length) await supabase.storage.from(CLICK_UP_BUCKET).remove(paths);
  await supabase.from("click_up_sheet_images").delete().eq("customer_order_id", customerOrderId);
}

async function deleteProductionAssets(orderUuid) {
  const { data: assets, error } = await supabase
    .from(PRODUCTION_ASSETS)
    .select("storage_bucket, storage_path")
    .eq("order_id", orderUuid);
  if (error) return;
  const byBucket = new Map();
  for (const row of assets ?? []) {
    const path = (row.storage_path ?? "").trim();
    if (!path) continue;
    const bucket = (row.storage_bucket ?? "production-order-assets").trim() || "production-order-assets";
    if (!byBucket.has(bucket)) byBucket.set(bucket, []);
    byBucket.get(bucket).push(path);
  }
  for (const [bucket, objectPaths] of byBucket) {
    await supabase.storage.from(bucket).remove(objectPaths);
  }
  await supabase.from(PRODUCTION_ASSETS).delete().eq("order_id", orderUuid);
}

async function cleanupPromoRedemptions(orderUuid) {
  const { data: redemptions } = await supabase
    .from("promotion_code_redemptions")
    .select("id, promotion_code_id")
    .eq("store_order_id", orderUuid);
  if (!redemptions?.length) return;
  const byPromo = new Map();
  for (const r of redemptions) {
    const pid = r.promotion_code_id;
    if (pid) byPromo.set(pid, (byPromo.get(pid) ?? 0) + 1);
  }
  await supabase.from("promotion_code_redemptions").delete().eq("store_order_id", orderUuid);
  for (const [promoId, count] of byPromo) {
    const { data: promo } = await supabase
      .from("promotion_codes")
      .select("redemption_count")
      .eq("id", promoId)
      .maybeSingle();
    if (!promo) continue;
    const next = Math.max(0, (promo.redemption_count ?? 0) - count);
    await supabase.from("promotion_codes").update({ redemption_count: next }).eq("id", promoId);
  }
}

async function main() {
  const { data: row, error: fetchErr } = await supabase
    .from("store_orders")
    .select("id, order_number, customer_email, status, total_cents")
    .eq("order_number", orderNumber)
    .maybeSingle();

  if (fetchErr) {
    console.error("Fetch error:", fetchErr.message);
    process.exit(1);
  }
  if (!row) {
    console.log(`No order found with order_number=${orderNumber}`);
    process.exit(0);
  }

  const id = row.id;
  console.log("Found order:", {
    id,
    order_number: row.order_number,
    customer_email: row.customer_email,
    status: row.status,
    total_cents: row.total_cents,
  });

  await deleteProductionAssets(id);
  await deleteClickUpImages(orderNumber);
  await supabase.from("supplier_order_lines").delete().eq("customer_order_id", orderNumber);
  await cleanupPromoRedemptions(id);

  const { error: delErr } = await supabase.from("store_orders").delete().eq("id", id);
  if (delErr) {
    console.error("Delete failed:", delErr.message);
    process.exit(1);
  }

  console.log(`Deleted store order ${orderNumber} (${id}) and related rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
