import Link from "next/link";
import { Fragment } from "react";

import { StoreOrderInvoiceReferenceForm } from "@/app/admin/(panel)/store-orders/store-order-invoice-reference-form";
import { formatMoneyFromCents } from "@/lib/store-order-utils";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { ADMIN_CUSTOMER_INVOICES_LIMIT } from "@/lib/customer-ordered-records";

export const dynamic = "force-dynamic";

function formatOrderDate(iso: string) {
  try {
    return new Date(iso).toLocaleString("en-AU", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

type OrderRow = {
  id: string;
  order_number: string;
  tracking_token: string;
  status: string;
  total_cents: number;
  currency: string;
  created_at: string;
  customer_email: string;
  customer_name: string;
  invoice_reference: string | null;
};

type LineRow = {
  order_id: string;
  product_name: string;
  quantity: number;
  line_total_cents: number;
  service_type: string | null;
  color: string | null;
  size: string | null;
};

const TRACKING_TOKEN_RE = /^[0-9a-f-]{36}$/i;
const ORDER_IDS_IN_CHUNK = 40;

function coerceOrderRows(raw: unknown): OrderRow[] {
  if (!Array.isArray(raw)) return [];
  const out: OrderRow[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) continue;
    const tracking_token = String(r.tracking_token ?? "").trim();
    out.push({
      id,
      order_number: String(r.order_number ?? "").trim() || "—",
      tracking_token: TRACKING_TOKEN_RE.test(tracking_token) ? tracking_token : "",
      status: String(r.status ?? "").trim() || "—",
      total_cents: typeof r.total_cents === "number" && Number.isFinite(r.total_cents) ? r.total_cents : Number(r.total_cents) || 0,
      currency: String(r.currency ?? "AUD").trim() || "AUD",
      created_at: String(r.created_at ?? "").trim() || new Date(0).toISOString(),
      customer_email: String(r.customer_email ?? "").trim(),
      customer_name: String(r.customer_name ?? "").trim(),
      invoice_reference:
        r.invoice_reference == null || r.invoice_reference === ""
          ? null
          : String(r.invoice_reference).trim().slice(0, 500) || null,
    });
  }
  return out;
}

export default async function AdminCustomerInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ invoiceSaved?: string; invoiceError?: string }>;
}) {
  const sp = await searchParams;
  const invoiceJustSaved = sp.invoiceSaved === "1";
  const invoiceSaveErrorRaw = typeof sp.invoiceError === "string" ? sp.invoiceError : "";
  let invoiceSaveError: string | null = null;
  try {
    invoiceSaveError = invoiceSaveErrorRaw ? decodeURIComponent(invoiceSaveErrorRaw) : null;
  } catch {
    invoiceSaveError = invoiceSaveErrorRaw || null;
  }
  let orders: OrderRow[] = [];
  let lineGroups: Record<string, LineRow[]> = {};
  let loadError: string | null = null;
  let serviceRoleMissing = false;

  try {
    const supabase = createSupabaseAdminClient();
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
      serviceRoleMissing = true;
    }

    const selectCandidates = [
      "id, order_number, tracking_token, status, total_cents, currency, created_at, customer_email, customer_name, invoice_reference",
      "id, order_number, tracking_token, status, total_cents, currency, created_at, customer_email, customer_name",
    ] as const;

    let o: unknown = null;
    let orderQueryError: { message?: string } | null = null;
    for (const sel of selectCandidates) {
      const res = await supabase
        .from("store_orders")
        .select(sel)
        .order("created_at", { ascending: false })
        .limit(ADMIN_CUSTOMER_INVOICES_LIMIT);
      if (!res.error) {
        o = res.data;
        orderQueryError = null;
        break;
      }
      orderQueryError = res.error as { message?: string };
    }

    if (orderQueryError) {
      loadError = orderQueryError.message ?? "Could not load orders.";
    } else {
      orders = coerceOrderRows(o);
    }

    const orderIds = orders.map((r) => r.id).filter(Boolean);
    for (let i = 0; i < orderIds.length; i += ORDER_IDS_IN_CHUNK) {
      const chunk = orderIds.slice(i, i + ORDER_IDS_IN_CHUNK);
      if (chunk.length === 0) continue;

      const { data: itemRows, error: itemsErr } = await supabase
        .from("store_order_items")
        .select("order_id, product_name, quantity, line_total_cents, service_type, color, size, sort_order")
        .in("order_id", chunk)
        .order("sort_order", { ascending: true });

      if (itemsErr) {
        loadError = loadError ?? itemsErr.message ?? "Could not load line items.";
        break;
      }
      for (const line of itemRows ?? []) {
        const oid = String((line as { order_id?: unknown }).order_id ?? "").trim();
        if (!oid) continue;
        if (!lineGroups[oid]) lineGroups[oid] = [];
        const qtyRaw = (line as { quantity?: unknown }).quantity;
        const qty = typeof qtyRaw === "number" && Number.isFinite(qtyRaw) ? qtyRaw : Number(qtyRaw) || 0;
        const lineTotalRaw = (line as { line_total_cents?: unknown }).line_total_cents;
        const lineTotal =
          typeof lineTotalRaw === "number" && Number.isFinite(lineTotalRaw) ? lineTotalRaw : Number(lineTotalRaw) || 0;
        lineGroups[oid].push({
          order_id: oid,
          product_name: String((line as { product_name?: unknown }).product_name ?? "").trim() || "—",
          quantity: qty,
          line_total_cents: lineTotal,
          service_type: (line as { service_type?: string | null }).service_type ?? null,
          color: (line as { color?: string | null }).color ?? null,
          size: (line as { size?: string | null }).size ?? null,
        });
      }
    }
  } catch {
    loadError = "Supabase is not configured or store_orders could not be read.";
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Admin</p>
        <h1 className="text-3xl font-medium text-brand-navy">Customer Invoices</h1>
        <p className="max-w-3xl text-sm text-slate-600">
          Edit the <strong>invoice number</strong> (manual / next-day Xero id) shown on customer PDFs — same field as
          Store orders. Latest{" "}
          <span className="font-mono">{ADMIN_CUSTOMER_INVOICES_LIMIT}</span> store orders. Use{" "}
          <strong>Detail &amp; Track</strong> to open the public order page (includes a tax-invoice PDF link).
        </p>
        {invoiceJustSaved ? (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-950">
            <strong>Invoice number saved.</strong> The customer tax invoice PDF uses this value in the{" "}
            <strong>Invoice number</strong> field on the next download.
            <Link href="/admin/customer-invoices" className="ml-2 font-semibold text-brand-orange underline">
              Dismiss
            </Link>
          </div>
        ) : null}
        {invoiceSaveError ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-950">
            <strong>Could not save.</strong>{" "}
            <span className="font-mono text-xs break-all">{invoiceSaveError.slice(0, 600)}</span>
            <Link href="/admin/customer-invoices" className="ml-2 font-semibold text-brand-orange underline">
              Dismiss
            </Link>
          </div>
        ) : null}
        {serviceRoleMissing ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <code className="rounded bg-white/80 px-1">SUPABASE_SERVICE_ROLE_KEY</code> is not set — if this list is
            empty, set the service role key in <code className="rounded bg-white/80 px-1">.env.local</code> so the
            server can read <code className="rounded bg-white/80 px-1">store_orders</code> (RLS blocks the anon key).
          </p>
        ) : null}
      </header>

      {loadError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-semibold">Could not load data</p>
          <p className="mt-1 font-mono text-xs break-all">{loadError}</p>
        </div>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {orders.length === 0 ? (
          <p className="p-6 text-[1.05rem] leading-snug text-slate-600">
            No store orders found. Completed checkout orders will appear here.
          </p>
        ) : (
          <div className="text-[1.05rem] leading-snug">
            <table className="w-full min-w-[64rem] border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-[0.9rem] font-semibold uppercase tracking-wide text-slate-600">
                <th className="px-4 py-3">Customer order ID</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Lines</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Detail &amp; Track</th>
                <th className="min-w-[19rem] px-4 py-3">Invoice number</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((row) => {
                const lines = lineGroups[row.id] ?? [];
                const token = row.tracking_token.trim();
                const tokenOk = TRACKING_TOKEN_RE.test(token);
                return (
                  <Fragment key={row.id}>
                    <tr className="border-b border-slate-100">
                      <td className="px-4 py-3 font-mono font-medium text-brand-navy">{row.order_number}</td>
                      <td className="px-4 py-3 text-slate-700">{formatOrderDate(row.created_at)}</td>
                      <td className="max-w-[10rem] truncate px-4 py-3 text-slate-800" title={row.customer_name || undefined}>
                        {row.customer_name || "—"}
                      </td>
                      <td className="max-w-[12rem] truncate px-4 py-3 text-slate-700" title={row.customer_email || undefined}>
                        {row.customer_email || "—"}
                      </td>
                      <td className="px-4 py-3 capitalize text-slate-700">{row.status}</td>
                      <td className="px-4 py-3 text-slate-700">{lines.length}</td>
                      <td className="px-4 py-3 text-slate-900">
                        {formatMoneyFromCents(row.total_cents, row.currency)}
                      </td>
                      <td className="px-4 py-3">
                        {tokenOk ? (
                          <Link
                            href={`/orders/track/${encodeURIComponent(token)}`}
                            className="font-semibold text-brand-orange hover:underline"
                          >
                            Detail &amp; Track
                          </Link>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="min-w-[19rem] align-top px-4 py-3">
                        <StoreOrderInvoiceReferenceForm
                          key={row.id}
                          orderId={row.id}
                          initialReference={row.invoice_reference}
                          className="space-y-1"
                          returnAfterSave="/admin/customer-invoices"
                          inputPlaceholder="Insert Xero Invoice Number"
                          taxInvoicePreviewOrderId={row.id}
                          invoicePreviewOrderLabel={row.order_number}
                          scaledListTypography
                          showInvoiceReferenceStatusDot
                        />
                      </td>
                    </tr>
                    <tr className="border-b border-slate-200 bg-slate-50/80">
                      <td colSpan={9} className="px-4 py-2">
                        <details className="group">
                          <summary className="cursor-pointer list-none font-semibold text-slate-700 marker:content-none [&::-webkit-details-marker]:hidden">
                            <span className="underline decoration-slate-300 decoration-1 underline-offset-2 group-open:text-brand-orange">
                              Line items ({lines.length})
                            </span>
                          </summary>
                          {lines.length === 0 ? (
                            <p className="mt-2 pl-1 text-slate-500">No line details stored.</p>
                          ) : (
                            <ul className="mt-3 space-y-2 border-l-2 border-brand-orange/30 pl-4">
                              {lines.map((line, idx) => {
                                const bits = [line.service_type, line.color, line.size]
                                  .map((s) => String(s ?? "").trim())
                                  .filter(Boolean);
                                return (
                                  <li key={`${row.id}-${idx}`} className="text-slate-800">
                                    <span className="font-medium text-brand-navy">{line.product_name}</span>
                                    <span className="text-slate-600"> × {line.quantity}</span>
                                    {bits.length > 0 ? (
                                      <span className="text-slate-500"> · {bits.join(" · ")}</span>
                                    ) : null}
                                    <span className="ml-2 text-slate-600">
                                      {formatMoneyFromCents(line.line_total_cents, row.currency)}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          )}
                        </details>
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-500">
        The same reference field is available on{" "}
        <Link href="/admin/store-orders" className="font-semibold text-brand-orange hover:underline">
          Store orders
        </Link>
        . After saving, refresh or re-open a PDF from the customer order page to see the updated invoice number.
      </p>
    </div>
  );
}
