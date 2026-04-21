import { notFound } from "next/navigation";

import { DocketAutoprint } from "@/app/admin/(panel)/store-orders/[id]/docket/docket-autoprint";
import { DocketPrintBar } from "@/app/admin/(panel)/store-orders/[id]/docket/docket-print-bar";
import { resolveDocketShipFromAddress, resolveDocketShipFromName } from "@/lib/docket-ship-from";
import { siteBaseUrl } from "@/lib/store-order-utils";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ autoprint?: string }>;
};

export default async function DeliveryDocketPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : {};
  const autoprint = sp.autoprint === "1" || sp.autoprint === "true";
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
      "order_number, delivery_address, customer_name, customer_email, tracking_number, carrier, tracking_token, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  /** Company (customer profile) preferred; else customer name on the order. */
  let deliverToCompanyOrName = (order.customer_name ?? "").trim();
  const emailRaw = (order.customer_email ?? "").trim();
  if (emailRaw) {
    const emailLower = emailRaw.toLowerCase();
    const { data: profEq } = await supabase
      .from("customer_profiles")
      .select("organisation")
      .eq("email_address", emailLower)
      .maybeSingle();
    const orgEq = profEq?.organisation?.trim();
    if (orgEq) {
      deliverToCompanyOrName = orgEq;
    } else {
      const { data: profIlike } = await supabase
        .from("customer_profiles")
        .select("organisation")
        .ilike("email_address", emailRaw)
        .maybeSingle();
      const orgI = profIlike?.organisation?.trim();
      if (orgI) {
        deliverToCompanyOrName = orgI;
      }
    }
  }

  const { data: lines } = await supabase
    .from("store_order_items")
    .select("product_name, quantity")
    .eq("order_id", id)
    .order("sort_order", { ascending: true });

  const fromName = resolveDocketShipFromName();
  const fromAddress = resolveDocketShipFromAddress();
  const trackUrl = `${siteBaseUrl()}/orders/track/${order.tracking_token}`;
  const barcodeUrl = `https://bwipjs-api.metafloor.com/?bcid=code128&text=${encodeURIComponent(order.order_number)}&includetext&scale=3&height=12`;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(trackUrl)}`;

  return (
    <>
      <style>{`
        /* Minimise printable margin; browser URL/date/page chrome is disabled in the print dialog (uncheck Headers and footers). */
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
          /* Admin panel shell: hide nav & chrome so only the docket prints */
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
          /* Full-size print (was scale(0.5); 2× larger on paper). */
          .docket-page {
            margin: 0 auto !important;
            padding: 6mm !important;
            box-sizing: border-box !important;
            max-width: 210mm !important;
          }
        }
        .docket-page { max-width: 210mm; margin: 0 auto; font-family: system-ui, sans-serif; color: #0f172a; }
        .docket-box { border: 2px solid #0f172a; padding: 14px; margin-bottom: 14px; }
        .docket-label { font-size: 15px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: #64748b; }
        .docket-h1 { font-size: 30px; font-weight: 700; margin: 4px 0 0; }
      `}</style>
      <DocketAutoprint enabled={autoprint} />
      <DocketPrintBar printButtonLabel="Print Docket" />
      <div className="docket-page p-4">
        <div className="docket-box">
          <p className="docket-label">Ship from</p>
          <p className="docket-h1">{fromName}</p>
          <pre className="mt-2 whitespace-pre-wrap text-sm leading-relaxed font-sans">{fromAddress}</pre>
        </div>

        <div className="docket-box">
          <p className="docket-label">Deliver to</p>
          {deliverToCompanyOrName ? <p className="docket-h1">{deliverToCompanyOrName}</p> : null}
          <p className="mt-2 whitespace-pre-wrap text-base font-medium leading-relaxed">{order.delivery_address}</p>
          <p className="mt-2 text-xs text-slate-600">
            Attn: {order.customer_name} · {order.customer_email}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="docket-box">
            <p className="docket-label">Order reference</p>
            <p className="docket-h1 font-mono">{order.order_number}</p>
            <p className="mt-2 text-xs text-slate-600">
              Order date: {new Date(order.created_at).toLocaleString("en-AU", { dateStyle: "medium" })}
            </p>
            {order.tracking_number ? (
              <p className="mt-2 text-sm">
                <span className="docket-label !inline">Post tracking</span>{" "}
                <span className="font-mono font-bold">{order.tracking_number}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-800">Tracking: add when shipped in Admin → Store orders.</p>
            )}
            <div className="mt-4 flex justify-center border border-slate-200 bg-white p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={barcodeUrl} alt="" width={280} height={80} className="max-w-full" />
            </div>
          </div>
          <div className="docket-box flex flex-col items-center justify-center text-center">
            <p className="docket-label">Customer tracking</p>
            <p className="mt-1 max-w-full break-all px-2 text-xs text-slate-600">{trackUrl}</p>
            <div className="mt-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrUrl} alt="" width={140} height={140} />
            </div>
          </div>
        </div>

        <div className="docket-box">
          <p className="docket-label">Contents summary</p>
          <ul className="mt-2 list-disc pl-5 text-sm">
            {(lines ?? []).map((l, i) => (
              <li key={`${l.product_name}-${i}`}>
                {l.product_name} × {l.quantity}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500">
            Carrier: {order.carrier}. This sheet is for packing / counter reference; use Australia Post prepaid or
            business labels where required for parcel network acceptance.
          </p>
        </div>
      </div>
    </>
  );
}
