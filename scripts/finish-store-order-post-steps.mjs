#!/usr/bin/env node
/**
 * Finish post-order steps when fulfillment crashed after DB insert (email, Xero, internal alert).
 * Usage: node scripts/finish-store-order-post-steps.mjs <order_number_or_uuid>
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv() {
  const content = readFileSync(join(process.cwd(), ".env.local"), "utf8");
  for (const line of content.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

loadEnv();

const key = process.argv[2]?.trim();
if (!key) {
  console.error("Usage: node scripts/finish-store-order-post-steps.mjs <order_number_or_uuid>");
  process.exit(1);
}

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const isUuid = /^[0-9a-f-]{36}$/i.test(key);
const { data: order, error } = await sb
  .from("store_orders")
  .select("id, order_number, customer_email, customer_name, delivery_address, total_cents, tracking_token, invoice_reference")
  .eq(isUuid ? "id" : "order_number", key)
  .maybeSingle();

if (error || !order) {
  console.error(error?.message ?? "Order not found");
  process.exit(1);
}

const { data: items } = await sb
  .from("store_order_items")
  .select("product_name, quantity")
  .eq("order_id", order.id)
  .order("sort_order");

const { formatMoneyFromCents } = await import("../lib/store-order-utils.ts");
const { sendStoreOrderConfirmationEmail } = await import("../lib/store-order-email.ts");
const { sendOnlineOrderInternalAlert } = await import("../lib/store-order-internal-alert.ts");

const totalFormatted = formatMoneyFromCents(order.total_cents, "AUD");
const lineSummary = (items ?? [])
  .slice(0, 6)
  .map((l) => `${l.quantity}× ${l.product_name}`)
  .join(", ");

const emailRes = await sendStoreOrderConfirmationEmail({
  to: order.customer_email,
  customerName: order.customer_name,
  orderNumber: order.order_number,
  trackingToken: order.tracking_token,
  totalFormatted,
  xeroInvoiceNumber: order.invoice_reference ?? undefined,
});
console.log("confirmation email:", emailRes.ok ? "sent" : emailRes.error);

const alertRes = await sendOnlineOrderInternalAlert({
  orderNumber: order.order_number,
  customerName: order.customer_name,
  customerEmail: order.customer_email,
  deliveryAddress: order.delivery_address,
  totalFormatted,
  lineCount: items?.length ?? 0,
  lineSummary,
});
console.log("internal alert:", alertRes.ok ? "sent" : "failed");

try {
  const { syncStoreOrderToXero } = await import("../lib/xero/sync-store-order.ts");
  const xeroRes = await syncStoreOrderToXero(order.id);
  console.log("xero:", xeroRes.ok ? `ok ${xeroRes.invoiceNumber ?? ""}` : xeroRes.error ?? xeroRes.skipped);
} catch (e) {
  console.error("xero:", e);
}
