import Link from "next/link";
import { notFound } from "next/navigation";

import { TopNav } from "@/app/components/top-nav";
import {
  mockupEmbroideryPrintingSummary,
  parseMockupDecorateMethodsJson,
} from "@/lib/click-up-sheet-mockup-methods";
import { serviceTypeColoredContent } from "@/lib/service-type-colored";
import { queryClickUpMockupImagesByCustomerOrderId } from "@/lib/fetch-click-up-mockups";
import { australiaPostTrackingUrl, formatMoneyFromCents } from "@/lib/store-order-utils";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { STORE_MAIN_SHELL_CLASS } from "@/lib/store-main-shell";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

import { OrderDeliveryStatusTracker } from "../order-delivery-status-tracker";
import { OrderTrackMockupsGrid } from "../order-track-mockups-grid";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ token: string }> };

export default async function OrderTrackPage({ params }: Props) {
  const { token } = await params;
  const trimmed = token?.trim();
  if (!trimmed || !/^[0-9a-f-]{36}$/i.test(trimmed)) {
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
      "id, order_number, status, customer_name, customer_email, delivery_address, delivery_fee_cents, subtotal_cents, total_cents, currency, carrier, tracking_number, shipped_at, created_at",
    )
    .eq("tracking_token", trimmed)
    .maybeSingle();

  if (error || !order) {
    notFound();
  }

  const { data: lineItems } = await supabase
    .from("store_order_items")
    .select("product_name, quantity, line_total_cents, service_type, color, size")
    .eq("order_id", order.id)
    .order("sort_order", { ascending: true });

  const orderNumberTrim = order.order_number.trim();
  const mockupQuery = orderNumberTrim
    ? await queryClickUpMockupImagesByCustomerOrderId(supabase, orderNumberTrim)
    : { ok: true as const, rows: [] };
  const mockupRows = mockupQuery.ok ? mockupQuery.rows : [];

  const trackMockups = mockupRows
    .map((r) => {
      const publicUrl = r.public_url?.trim() ?? "";
      if (!publicUrl) {
        return null;
      }
      const decorateLabels = parseMockupDecorateMethodsJson(r.mockup_decorate_methods);
      const memoRaw = r.mockup_memo;
      const memo =
        memoRaw != null && String(memoRaw).trim().length > 0 ? String(memoRaw).trim() : null;
      return {
        id: r.id,
        publicUrl,
        listDate: r.list_date,
        decorateSummary: mockupEmbroideryPrintingSummary(decorateLabels),
        memo,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const apLink =
    order.status === "shipped" &&
    order.tracking_number &&
    (order.carrier.toLowerCase().includes("australia post") ||
      order.carrier.toLowerCase().includes("auspost"))
      ? australiaPostTrackingUrl(order.tracking_number)
      : null;

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <div className={STORE_MAIN_SHELL_CLASS}>
        <section className={`${SITE_PAGE_ROW_CLASS} py-10`}>
          <div className="mx-auto w-full max-w-[70%] space-y-8 leading-snug">
            <header className="space-y-2">
              <p className="text-lg font-semibold uppercase tracking-[0.12em] text-brand-navy/60">
                Customer order ID
              </p>
              <h1 className="font-mono text-[2.8125rem] font-medium leading-tight">{order.order_number}</h1>
              <p className="text-[1.3125rem] text-brand-navy/70">
                Placed {new Date(order.created_at).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" })}
              </p>
            </header>

            <div className="rounded-2xl border border-brand-navy/15 bg-brand-surface/40 p-6">
              <h2 className="text-[1.3125rem] font-semibold uppercase tracking-[0.08em] text-brand-navy/70">
                Delivery status
              </h2>
              <OrderDeliveryStatusTracker
                trackingToken={trimmed}
                initialPayload={{
                  status: order.status,
                  created_at: order.created_at,
                  shipped_at: order.shipped_at ?? null,
                  tracking_number: order.tracking_number ?? null,
                  carrier: order.carrier ?? "Australia Post",
                }}
                initialAusPostUrl={apLink}
              />
            </div>

            <div className="rounded-2xl border border-brand-navy/15 p-6">
              <h2 className="text-[1.3125rem] font-semibold uppercase tracking-[0.08em] text-brand-navy/70">Ship to</h2>
              <p className="mt-2 whitespace-pre-line text-[1.3125rem]">{order.delivery_address}</p>
            </div>

            <div className="rounded-2xl border border-brand-navy/15 p-6">
              <h2 className="text-[1.3125rem] font-semibold uppercase tracking-[0.08em] text-brand-navy/70">Items</h2>
              <ul className="mt-4 space-y-4">
                {(lineItems ?? []).map((row, i) => (
                  <li key={`${row.product_name}-${i}`} className="flex justify-between gap-5 text-[1.3125rem]">
                    <div>
                      <p className="font-medium">{row.product_name}</p>
                      <p className="text-brand-navy/65">
                        Qty {row.quantity}
                        {row.service_type ? (
                          <>
                            {" · "}
                            {serviceTypeColoredContent(row.service_type)}
                          </>
                        ) : null}
                        {row.color ? ` · ${row.color}` : ""}
                        {row.size ? ` · ${row.size}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium tabular-nums">
                      {formatMoneyFromCents(row.line_total_cents, order.currency)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 space-y-1 border-t border-brand-navy/10 pt-5 text-[1.3125rem]">
                <p className="flex justify-between">
                  <span>Subtotal</span>
                  <span>{formatMoneyFromCents(order.subtotal_cents, order.currency)}</span>
                </p>
                <p className="flex justify-between">
                  <span>Delivery</span>
                  <span>
                    {order.delivery_fee_cents === 0
                      ? "Free"
                      : formatMoneyFromCents(order.delivery_fee_cents, order.currency)}
                  </span>
                </p>
                <p className="flex justify-between text-2xl font-semibold">
                  <span>Total</span>
                  <span>{formatMoneyFromCents(order.total_cents, order.currency)}</span>
                </p>
              </div>
              <p className="mt-5 text-center">
                <a
                  href={`/api/orders/tax-invoice?token=${encodeURIComponent(trimmed)}`}
                  className="text-[1.3125rem] font-semibold text-brand-orange hover:underline"
                >
                  Download tax invoice
                </a>
              </p>
            </div>

            <div className="rounded-2xl border border-brand-navy/15 p-6">
              <h2 className="text-[1.3125rem] font-semibold uppercase tracking-[0.08em] text-brand-navy/70">
                Mock-up designs
              </h2>
              {trackMockups.length === 0 ? (
                <p className="mt-3 text-[1.3125rem] text-brand-navy/70">
                  No mock-up files are linked to this order yet. If your order includes custom artwork, they may appear
                  here after production uploads them.
                </p>
              ) : (
                <OrderTrackMockupsGrid orderNumber={order.order_number} items={trackMockups} />
              )}
            </div>

            <p className="text-center text-[1.3125rem] text-brand-navy/60">
              <Link href="/customer" className="font-semibold text-brand-orange hover:underline">
                Back to My account
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
