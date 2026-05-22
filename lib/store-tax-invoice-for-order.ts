import { buildStoreTaxInvoicePdfBuffer } from "@/lib/store-tax-invoice-pdf";
import { loadTaxInvoiceSellerFromEnv, taxInvoiceFilename } from "@/lib/store-tax-invoice";
import { createSupabaseAdminClient } from "@/lib/supabase";

export async function buildStoreTaxInvoicePdfForOrderId(
  orderId: string,
): Promise<{ ok: true; buffer: Buffer; filename: string } | { ok: false; error: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
    return { ok: false, error: "Invalid order id." };
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return { ok: false, error: "Database not configured." };
  }

  const orderSelect =
    "id, order_number, created_at, customer_name, customer_email, delivery_address, subtotal_cents, delivery_fee_cents, total_cents, currency, invoice_reference";

  const { data: order, error: orderErr } = await supabase
    .from("store_orders")
    .select(orderSelect)
    .eq("id", orderId)
    .maybeSingle();

  if (orderErr || !order) {
    return { ok: false, error: orderErr?.message ?? "Order not found." };
  }

  let customer_organisation: string | null = null;
  const orderEmail = String(order.customer_email ?? "").trim();
  if (orderEmail) {
    const ilikeEmail = orderEmail.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const profRes = await supabase
      .from("customer_profiles")
      .select("organisation")
      .ilike("email_address", ilikeEmail)
      .maybeSingle();
    if (!profRes.error && profRes.data) {
      const org = (profRes.data as { organisation?: unknown }).organisation;
      customer_organisation = typeof org === "string" ? org : org != null ? String(org).trim() || null : null;
    }
  }

  const { data: lineRows, error: linesErr } = await supabase
    .from("store_order_items")
    .select("product_name, quantity, unit_price_cents, line_total_cents, service_type, color, size")
    .eq("order_id", orderId)
    .order("sort_order", { ascending: true });

  if (linesErr) {
    return { ok: false, error: linesErr.message };
  }

  try {
    const buffer = await buildStoreTaxInvoicePdfBuffer(
      loadTaxInvoiceSellerFromEnv(),
      { ...order, customer_organisation },
      lineRows ?? [],
    );
    return { ok: true, buffer, filename: taxInvoiceFilename(order.order_number) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "PDF generation failed." };
  }
}
