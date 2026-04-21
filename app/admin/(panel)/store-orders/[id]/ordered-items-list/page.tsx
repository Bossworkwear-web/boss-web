import { notFound } from "next/navigation";

import { DocketPrintBar } from "@/app/admin/(panel)/store-orders/[id]/docket/docket-print-bar";
import { serviceTypeColoredContent } from "@/lib/service-type-colored";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

function formatPlacements(placements: unknown): string {
  if (placements == null) return "—";
  if (typeof placements === "string") return placements.trim() || "—";
  try {
    const s = JSON.stringify(placements);
    return s.length > 120 ? `${s.slice(0, 117)}…` : s;
  } catch {
    return "—";
  }
}

export default async function OrderedItemsListPage({ params }: Props) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id ?? "")) {
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
    .select(
      "order_number, delivery_address, customer_name, customer_email, tracking_number, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  const { data: lines } = await supabase
    .from("store_order_items")
    .select(
      "product_name, quantity, color, size, service_type, notes, placements, sort_order",
    )
    .eq("order_id", id)
    .order("sort_order", { ascending: true });

  const itemsHint = (
    <>
      In the print dialog, turn off <strong>Headers and footers</strong> (Chrome/Edge). Use this list to pick and verify
      items before packing; it does not replace the delivery docket for postage.
    </>
  );

  return (
    <>
      <style>{`
        @page {
          margin: 0;
          size: auto;
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
          .docket-page {
            margin: 0 auto !important;
            padding: 6mm !important;
            box-sizing: border-box !important;
            max-width: 210mm !important;
          }
        }
        .docket-page { max-width: 210mm; margin: 0 auto; font-family: system-ui, sans-serif; color: #0f172a; }
        .docket-box { border: none; padding: 14px; margin-bottom: 14px; }
        .docket-label { font-size: 15px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
        .docket-h1 { font-size: 30px; font-weight: 700; margin: 4px 0 0; }
        .ordered-items-table { width: 100%; border-collapse: collapse; font-size: 19.5px; }
        .ordered-items-table th, .ordered-items-table td {
          border: 1px solid #0f172a;
          padding: 8px 10px;
          text-align: left;
          vertical-align: top;
        }
        .ordered-items-table th {
          background: #f1f5f9;
          font-weight: 700;
          text-transform: uppercase;
          font-size: 15px;
          letter-spacing: 0.06em;
          color: #475569;
        }
      `}</style>
      <DocketPrintBar printButtonLabel="Print ordered items list" hint={itemsHint} />
      <div className="docket-page p-4">
        <div className="docket-box">
          <p className="docket-label">Ordered items list</p>
          <p className="docket-h1 font-mono">{order.order_number}</p>
          <p className="mt-2 text-sm">
            <span className="font-medium">{order.customer_name}</span>
            <span className="text-slate-600"> · {order.customer_email}</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            Order date: {new Date(order.created_at).toLocaleString("en-AU", { dateStyle: "medium" })}
          </p>
          {order.tracking_number ? (
            <p className="mt-2 font-mono text-sm font-semibold">Tracking: {order.tracking_number}</p>
          ) : null}
          <div className="mt-3 border-t border-slate-200 pt-3">
            <p className="docket-label">Ship to</p>
            <p className="mt-1 whitespace-pre-wrap text-sm font-medium leading-relaxed">{order.delivery_address}</p>
          </div>
        </div>

        <div className="docket-box">
          <p className="docket-label">Line items — verify before packing</p>
          <div className="mt-3 overflow-x-auto">
            <table className="ordered-items-table">
              <thead>
                <tr>
                  <th scope="col">Product</th>
                  <th scope="col">Qty</th>
                  <th scope="col">Color</th>
                  <th scope="col">Size</th>
                  <th scope="col">Service</th>
                  <th scope="col">Placements</th>
                  <th scope="col">Notes</th>
                </tr>
              </thead>
              <tbody>
                {(lines ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-slate-500">
                      No line items on this order.
                    </td>
                  </tr>
                ) : (
                  (lines ?? []).map((line, i) => (
                    <tr key={`${line.product_name}-${i}`}>
                      <td className="font-medium">{line.product_name}</td>
                      <td className="tabular-nums">{line.quantity}</td>
                      <td>{line.color?.trim() || "—"}</td>
                      <td>{line.size?.trim() || "—"}</td>
                      <td>{serviceTypeColoredContent(line.service_type)}</td>
                      <td className="max-w-[10rem] break-words text-xs">{formatPlacements(line.placements)}</td>
                      <td className="max-w-[12rem] break-words text-xs">{line.notes?.trim() || "—"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Check off each line when picked. For embroidery or custom placements, match the service and placement
            details to the physical goods.
          </p>
        </div>
      </div>
    </>
  );
}
