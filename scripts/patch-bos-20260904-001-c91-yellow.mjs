#!/usr/bin/env node
/**
 * One-off: BOS_20260904_001 — change C91 lines Safety Orange/navy blue → Safety Yellow/Navy blue.
 * Updates store_order_items + supplier_order_lines. Does not email the customer.
 *
 * Usage: node scripts/patch-bos-20260904-001-c91-yellow.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { loadEnvLocal } from "./lib/load-env.mjs";

loadEnvLocal();

const ORDER_NUMBER = "BOS_20260904_001";
const FROM_COLOR = "Safety Orange/navy blue";
const TO_COLOR = "Safety Yellow/Navy blue";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !key) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function isC91Product(row) {
  const pid = String(row.product_id ?? "").toUpperCase();
  const name = String(row.product_name ?? "").toUpperCase();
  return pid.includes("C91") || /\(C91\)/.test(name) || name.includes("C91");
}

function isOrangeColor(color) {
  const c = String(color ?? "").trim().toLowerCase();
  return c.includes("orange") && c.includes("navy");
}

async function main() {
  const { data: order, error: orderErr } = await supabase
    .from("store_orders")
    .select("id, order_number, xero_invoice_id, xero_invoice_number, invoice_reference")
    .eq("order_number", ORDER_NUMBER)
    .maybeSingle();
  if (orderErr) throw orderErr;
  if (!order) {
    console.error("Order not found:", ORDER_NUMBER);
    process.exit(1);
  }
  console.log("Order", order.order_number, order.id);
  console.log("Xero invoice:", order.xero_invoice_id ?? "(none)", order.xero_invoice_number ?? "");

  const { data: items, error: itemsErr } = await supabase
    .from("store_order_items")
    .select("id, product_id, product_name, color, size, quantity, notes")
    .eq("order_id", order.id)
    .order("sort_order", { ascending: true });
  if (itemsErr) throw itemsErr;

  const c91Orange = (items ?? []).filter((r) => isC91Product(r) && isOrangeColor(r.color));
  console.log("store_order_items C91 orange lines:", c91Orange.length);
  for (const r of c91Orange) {
    console.log(" -", r.id, r.product_id, r.color, r.size, "x" + r.quantity);
  }

  for (const r of c91Orange) {
    const { error } = await supabase
      .from("store_order_items")
      .update({ color: TO_COLOR })
      .eq("id", r.id);
    if (error) throw error;
    console.log("Updated store_order_items", r.id, "→", TO_COLOR);
  }

  const { data: soLines, error: soErr } = await supabase
    .from("supplier_order_lines")
    .select("id, supplier, product_id, colour, size, quantity, notes, store_order_item_id")
    .eq("customer_order_id", ORDER_NUMBER);
  if (soErr) throw soErr;

  const soC91Orange = (soLines ?? []).filter((r) => {
    const pid = String(r.product_id ?? "").toUpperCase();
    return (pid.includes("C91") || pid.includes("BW-C91")) && isOrangeColor(r.colour);
  });
  console.log("supplier_order_lines C91 orange lines:", soC91Orange.length);
  for (const r of soC91Orange) {
    console.log(" -", r.id, r.product_id, r.colour, r.size, "x" + r.quantity);
  }

  for (const r of soC91Orange) {
    let notes = String(r.notes ?? "");
    if (/orange/i.test(notes)) {
      notes = notes
        .replace(/Safety Orange\/navy blue/gi, TO_COLOR)
        .replace(/Safety Orange\/Navy blue/gi, TO_COLOR)
        .replace(/Orange\/navy blue/gi, "Yellow/Navy blue");
    }
    const patch = { colour: TO_COLOR };
    if (notes !== String(r.notes ?? "")) patch.notes = notes;
    const { error } = await supabase.from("supplier_order_lines").update(patch).eq("id", r.id);
    if (error) throw error;
    console.log("Updated supplier_order_lines", r.id, "→", TO_COLOR);
  }

  // Verify
  const { data: itemsAfter } = await supabase
    .from("store_order_items")
    .select("product_id, product_name, color, size, quantity")
    .eq("order_id", order.id)
    .order("sort_order", { ascending: true });
  console.log("\nstore_order_items after:");
  for (const r of itemsAfter ?? []) {
    if (isC91Product(r)) console.log(" -", r.product_id || r.product_name, r.color, r.size, "x" + r.quantity);
  }

  const { data: soAfter } = await supabase
    .from("supplier_order_lines")
    .select("product_id, colour, size, quantity")
    .eq("customer_order_id", ORDER_NUMBER);
  console.log("supplier_order_lines C91 after:");
  for (const r of soAfter ?? []) {
    if (String(r.product_id ?? "").toUpperCase().includes("C91")) {
      console.log(" -", r.product_id, r.colour, r.size, "x" + r.quantity);
    }
  }

  console.log("\nDone. Tax invoice PDF/HTML regenerates from DB on next view.");
  console.log("Customer email was NOT sent.");
  if (order.xero_invoice_id) {
    console.log(
      "Note: Xero invoice",
      order.xero_invoice_number || order.xero_invoice_id,
      "still has original line descriptions unless updated separately in Xero.",
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
