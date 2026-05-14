import { notFound } from "next/navigation";

import { DocketAutoprint } from "@/app/admin/(panel)/store-orders/[id]/docket/docket-autoprint";
import { DocketPrintBar } from "@/app/admin/(panel)/store-orders/[id]/docket/docket-print-bar";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ storeOrderId: string }>;
  searchParams?: Promise<{ autoprint?: string }>;
};

function cell(v: unknown): string {
  const s = v == null ? "" : String(v).trim();
  return s.length > 0 ? s : "—";
}

export default async function DispatchOrderDetailPrintPage({ params, searchParams }: Props) {
  const { storeOrderId } = await params;
  const sp = searchParams ? await searchParams : {};
  const autoprint = sp.autoprint === "1" || sp.autoprint === "true";

  if (!/^[0-9a-f-]{36}$/i.test(storeOrderId ?? "")) {
    notFound();
  }

  let supabase: ReturnType<typeof createSupabaseAdminClient>;
  try {
    supabase = createSupabaseAdminClient();
  } catch {
    notFound();
  }

  const { data: order, error } = await supabase
    .from("store_orders")
    .select("order_number, customer_name, created_at")
    .eq("id", storeOrderId)
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  const { data: lines } = await supabase
    .from("store_order_items")
    .select("product_name, quantity, color, size")
    .eq("order_id", storeOrderId)
    .order("sort_order", { ascending: true });

  const rows = lines ?? [];

  const orderDateLabel =
    order.created_at != null && String(order.created_at).trim() !== ""
      ? new Date(order.created_at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })
      : "—";

  return (
    <>
      <style>{`
        @page {
          margin: 0;
          size: auto;
        }
        /* Preview (screen / iframe): enlarge document 1.7×; print stays normal size */
        @media screen {
          .dispatch-order-detail-print {
            zoom: 1.7;
          }
        }
        @media print {
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #fff !important;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .admin-root-print-shell > aside {
            display: none !important;
          }
          .admin-panel-print-mobile-banner {
            display: none !important;
          }
          .admin-panel-print-main {
            padding-left: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
          }
          .admin-panel-print-zoom {
            zoom: 1 !important;
          }
          .admin-panel-print-content-row {
            padding-top: 0 !important;
            padding-bottom: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }
          .no-print { display: none !important; }
          .dispatch-order-detail-print {
            zoom: 1 !important;
            margin: 0 auto !important;
            padding: 6mm !important;
            box-sizing: border-box !important;
            max-width: 210mm !important;
          }
        }
        .dispatch-order-detail-print {
          max-width: 210mm;
          margin: 0 auto;
          font-family: system-ui, sans-serif;
          color: #0f172a;
        }
        .dispatch-order-detail-print .doc-label {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #64748b;
        }
        .dispatch-order-detail-print table {
          width: 100%;
          border-collapse: collapse;
          font-size: 14px;
        }
        .dispatch-order-detail-print th,
        .dispatch-order-detail-print td {
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          text-align: left;
          vertical-align: top;
        }
        .dispatch-order-detail-print thead th {
          background: #f8fafc;
          font-weight: 700;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: #475569;
        }
      `}</style>
      <DocketAutoprint enabled={autoprint} />
      <DocketPrintBar
        printButtonLabel="Print order detail"
        hint={
          <>
            Dispatch packing reference: Order ID, Order date, customer, and line items (product, colour, size, qty).
            Turn off{" "}
            <strong>Headers and footers</strong> in the print dialog when previewing.
          </>
        }
      />
      <div className="dispatch-order-detail-print p-4">
        <p className="doc-label">Dispatch · Order detail</p>
        <h1 className="mt-1 text-2xl font-semibold text-brand-navy">Ordered products</h1>

        <div className="mt-6 space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm">
          <p className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <span>
              <span className="doc-label mr-2 inline-block min-w-[7rem]">Order ID</span>
              <span className="font-mono font-semibold text-brand-navy">{order.order_number}</span>
            </span>
            <span>
              <span className="doc-label mr-2">Order date</span>
              <span className="font-medium tabular-nums text-slate-900">{orderDateLabel}</span>
            </span>
          </p>
          <p>
            <span className="doc-label mr-2 inline-block min-w-[7rem]">Customer name</span>
            <span className="font-medium text-slate-900">{cell(order.customer_name)}</span>
          </p>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Product name</th>
                <th>Colour</th>
                <th>Size</th>
                <th className="w-24">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center text-slate-500">
                    No line items on this order.
                  </td>
                </tr>
              ) : (
                rows.map((line, i) => (
                  <tr key={`${cell(line.product_name)}-${i}`}>
                    <td>{cell(line.product_name)}</td>
                    <td>{cell(line.color)}</td>
                    <td>{cell(line.size)}</td>
                    <td className="tabular-nums font-medium">{cell(line.quantity)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
