import { type NextRequest, NextResponse } from "next/server";

import { buildStoreTaxInvoicePdfBuffer } from "@/lib/store-tax-invoice-pdf";
import { loadTaxInvoiceSellerFromEnv, taxInvoiceFilename } from "@/lib/store-tax-invoice";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const orderId = request.nextUrl.searchParams.get("orderId")?.trim() ?? "";
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

  if (!orderId && !token) {
    return NextResponse.json({ error: "Missing orderId or token." }, { status: 400 });
  }
  if (orderId && token) {
    return NextResponse.json({ error: "Use either orderId or token, not both." }, { status: 400 });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error("[tax-invoice] SUPABASE_SERVICE_ROLE_KEY is not set; store_orders is not readable under RLS with the anon key.");
    return NextResponse.json(
      {
        error:
          "Invoice download is not configured. Set SUPABASE_SERVICE_ROLE_KEY on the server (see .env.example).",
      },
      { status: 503 },
    );
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Server configuration error." }, { status: 503 });
  }

  /** Minimal columns for PDF — avoids 404 when optional columns are missing from an older DB. */
  const orderSelectBase =
    "id, order_number, created_at, customer_name, customer_email, delivery_address, subtotal_cents, delivery_fee_cents, total_cents, currency";

  let query = supabase.from("store_orders").select(orderSelectBase);

  if (token) {
    if (!/^[0-9a-f-]{36}$/i.test(token)) {
      return NextResponse.json({ error: "Invalid token." }, { status: 400 });
    }
    query = query.eq("tracking_token", token);
  } else {
    if (!/^[0-9a-f-]{36}$/i.test(orderId)) {
      return NextResponse.json({ error: "Invalid order id." }, { status: 400 });
    }
    const sessionEmail = request.cookies.get("customer_email")?.value?.trim() ?? "";
    if (!sessionEmail) {
      return NextResponse.json({ error: "Sign in to download this invoice." }, { status: 401 });
    }
    const ilikeExact = sessionEmail.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    query = query.eq("id", orderId).ilike("customer_email", ilikeExact);
  }

  const { data: order, error: orderErr } = await query.maybeSingle();

  if (orderErr) {
    console.error("[tax-invoice] store_orders:", orderErr.code, orderErr.message, orderErr.details);
    return NextResponse.json({ error: "Could not load this order from the database." }, { status: 500 });
  }
  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  /** Optional column — fetch separately so missing migration does not break downloads. */
  let invoice_reference: string | null = null;
  const refRes = await supabase.from("store_orders").select("invoice_reference").eq("id", order.id).maybeSingle();
  if (!refRes.error && refRes.data && typeof (refRes.data as { invoice_reference?: unknown }).invoice_reference !== "undefined") {
    const v = (refRes.data as { invoice_reference: string | null }).invoice_reference;
    invoice_reference = v == null || typeof v === "string" ? v : null;
  }

  let customer_organisation: string | null = null;
  const orderEmail = (order.customer_email ?? "").trim();
  if (orderEmail) {
    const ilikeEmail = orderEmail.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const profRes = await supabase
      .from("customer_profiles")
      .select("organisation")
      .ilike("email_address", ilikeEmail)
      .maybeSingle();
    if (!profRes.error && profRes.data) {
      const org = (profRes.data as { organisation?: unknown }).organisation;
      customer_organisation = typeof org === "string" ? org : null;
    }
  }

  const orderForPdf = { ...order, invoice_reference, customer_organisation };

  const { data: lineRows, error: linesErr } = await supabase
    .from("store_order_items")
    .select("product_name, quantity, unit_price_cents, line_total_cents, service_type, color, size")
    .eq("order_id", order.id)
    .order("sort_order", { ascending: true });

  if (linesErr) {
    return NextResponse.json({ error: "Could not load order lines." }, { status: 500 });
  }

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = await buildStoreTaxInvoicePdfBuffer(loadTaxInvoiceSellerFromEnv(), orderForPdf, lineRows ?? []);
  } catch (err) {
    console.error("[tax-invoice] PDF generation failed:", err);
    return NextResponse.json({ error: "Could not generate invoice PDF." }, { status: 500 });
  }
  const filename = taxInvoiceFilename(orderForPdf.order_number);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
