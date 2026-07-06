import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { sendOnlineOrderInternalAlert } from "@/lib/store-order-internal-alert";
import { sendStoreOrderConfirmationEmail } from "@/lib/store-order-email";
import { formatMoneyFromCents } from "@/lib/store-order-utils";
import { createSupabaseAdminClient } from "@/lib/supabase";

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

describe("finish Wayne Sun order notifications (integration)", () => {
  it.skip("send confirmation + internal alert for BOS_20260706_001", async () => {
    loadEnv();
    const supabase = createSupabaseAdminClient();
    const orderNumber = "BOS_20260706_001";
    const { data: order } = await supabase
      .from("store_orders")
      .select("id, order_number, customer_email, customer_name, delivery_address, total_cents, tracking_token, invoice_reference")
      .eq("order_number", orderNumber)
      .single();
    expect(order).toBeTruthy();
    const { data: items } = await supabase
      .from("store_order_items")
      .select("product_name, quantity")
      .eq("order_id", order!.id)
      .order("sort_order");
    const totalFormatted = formatMoneyFromCents(order!.total_cents, "AUD");
    const emailRes = await sendStoreOrderConfirmationEmail({
      to: order!.customer_email,
      customerName: order!.customer_name,
      orderNumber: order!.order_number,
      trackingToken: order!.tracking_token,
      totalFormatted,
      xeroInvoiceNumber: order!.invoice_reference ?? undefined,
    });
    expect(emailRes.ok).toBe(true);
    const lineSummary = (items ?? []).slice(0, 6).map((l) => `${l.quantity}× ${l.product_name}`).join(", ");
    const alertRes = await sendOnlineOrderInternalAlert({
      orderNumber: order!.order_number,
      customerName: order!.customer_name,
      customerEmail: order!.customer_email,
      deliveryAddress: order!.delivery_address,
      totalFormatted,
      lineCount: items?.length ?? 0,
      lineSummary,
    });
    expect(alertRes.ok).toBe(true);
  }, 60_000);
});
