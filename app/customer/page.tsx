import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Fragment } from "react";

import { ArrowLeftIcon } from "@/app/components/icons";
import { TopNav } from "@/app/components/top-nav";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { formatPerthDateTime } from "@/lib/perth-calendar";
import { formatMoneyFromCents } from "@/lib/store-order-utils";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";
import { MY_ACCOUNT_ORDERED_RECORDS_LIMIT } from "@/lib/customer-ordered-records";
import { getCustomerStoreCreditBalanceCents } from "@/lib/customer-store-credit";
import { currentProductUnitFromRow, repriceQuoteLines } from "@/lib/customer-quote-pricing";
import { CUSTOMER_QUOTE_RETENTION_DAYS, customerQuoteRetentionCutoffIso } from "@/lib/customer-quote";
import { STOREFRONT_QUOTE_EMAIL_RECIPIENT } from "@/lib/storefront-quote-mailto";
import {
  normalizeProofStatus,
  proofApproveUrl,
  proofStatusLabel,
  type OrderProofStatus,
} from "@/lib/order-proof";

import { ClearCartOnPlaced } from "./clear-cart-on-placed";
import { CustomerDetailPasswordPopovers } from "./customer-detail-password-popovers";
import { DeleteQuoteButton } from "./delete-quote-button";
import { OrderFromQuoteButton } from "./order-from-quote-button";
import { ReorderOrderButton } from "./reorder-order-button";

export const dynamic = "force-dynamic";

type CustomerPageProps = {
  searchParams: Promise<{ password?: string; placed?: string }>;
};

function formatOrderDate(iso: string) {
  try {
    return formatPerthDateTime(iso);
  } catch {
    return iso;
  }
}

export default async function CustomerPage({ searchParams }: CustomerPageProps) {
  const params = await searchParams;
  const passwordStatus = params.password;

  const cookieStore = await cookies();
  const sessionEmail = (cookieStore.get("customer_email")?.value ?? "").trim();
  const sessionName = (cookieStore.get("customer_name")?.value ?? "").trim();

  if (!sessionEmail) {
    redirect("/log-in");
  }

  const emailNorm = sessionEmail.toLowerCase();

  let profile: {
    customer_name: string;
    organisation: string;
    contact_number: string;
    email_address: string;
    delivery_address: string;
    billing_address: string;
    login_password: string | null;
    auth_user_id: string | null;
  } | null = null;

  let orders: {
    id: string;
    order_number: string;
    tracking_token: string;
    status: string;
    total_cents: number;
    currency: string;
    created_at: string;
    /** When set (trimmed non-empty), My account Invoice → Download is enabled. */
    invoice_reference: string | null;
    /** Latest design-proof round for this order (if any). */
    proof: { status: OrderProofStatus; token: string } | null;
  }[] = [];

  let orderLineGroups: Record<
    string,
    {
      product_name: string;
      quantity: number;
      line_total_cents: number;
      service_type: string | null;
      color: string | null;
      size: string | null;
    }[]
  > = {};

  let masterLogoUrl: string | null = null;
  /** When the store_orders list query included `invoice_reference`, gate My account Invoice → Download on that value. */
  let orderQueryIncludesInvoiceReference = false;
  let storeCreditBalanceCents = 0;

  let quotes: {
    id: string;
    quote_number: string;
    total_cents: number;
    total_quantity: number;
    currency: string;
    created_at: string;
    /** True when current product prices differ from the prices saved on the quote. */
    price_updated: boolean;
    lines: { product_name: string; quantity: number; service_type: string; color: string; size: string }[];
  }[] = [];

  try {
    const supabase = createSupabaseAdminClient();
    const { data: p } = await supabase
      .from("customer_profiles")
      .select(
        "customer_name, organisation, contact_number, email_address, delivery_address, billing_address, login_password, auth_user_id",
      )
      .eq("email_address", emailNorm)
      .maybeSingle();
    profile = p;

    storeCreditBalanceCents = await getCustomerStoreCreditBalanceCents(supabase, emailNorm);

    const { data: master } = await supabase
      .from("customer_master_company_logo")
      .select("storage_bucket, storage_path")
      .eq("customer_email", emailNorm)
      .maybeSingle();
    const bucket = String((master as { storage_bucket?: string | null })?.storage_bucket ?? "").trim();
    const path = String((master as { storage_path?: string | null })?.storage_path ?? "").trim();
    masterLogoUrl = bucket && path ? publicStorageObjectUrl(bucket, path) : null;

    const ilikeExact = sessionEmail.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
    const withRef = await supabase
      .from("store_orders")
      .select(
        "id, order_number, tracking_token, status, total_cents, currency, created_at, invoice_reference",
      )
      .ilike("customer_email", ilikeExact)
      .order("created_at", { ascending: false })
      .limit(MY_ACCOUNT_ORDERED_RECORDS_LIMIT);

    let rawOrders: Record<string, unknown>[] = [];
    if (!withRef.error) {
      orderQueryIncludesInvoiceReference = true;
      rawOrders = (withRef.data ?? []) as unknown as Record<string, unknown>[];
    } else {
      orderQueryIncludesInvoiceReference = false;
      const withoutRef = await supabase
        .from("store_orders")
        .select("id, order_number, tracking_token, status, total_cents, currency, created_at")
        .ilike("customer_email", ilikeExact)
        .order("created_at", { ascending: false })
        .limit(MY_ACCOUNT_ORDERED_RECORDS_LIMIT);
      rawOrders = (withoutRef.data ?? []) as unknown as Record<string, unknown>[];
    }

    orders = rawOrders.map((r) => {
      const refRaw = r.invoice_reference;
      const invoice_reference =
        refRaw == null || refRaw === ""
          ? null
          : typeof refRaw === "string"
            ? refRaw.trim().slice(0, 500) || null
            : String(refRaw).trim().slice(0, 500) || null;
      return {
        id: String(r.id ?? ""),
        order_number: String(r.order_number ?? "").trim() || "—",
        tracking_token: String(r.tracking_token ?? "").trim(),
        status: String(r.status ?? "").trim() || "—",
        total_cents: typeof r.total_cents === "number" && Number.isFinite(r.total_cents) ? r.total_cents : Number(r.total_cents) || 0,
        currency: String(r.currency ?? "AUD").trim() || "AUD",
        created_at: String(r.created_at ?? "").trim() || new Date(0).toISOString(),
        invoice_reference,
        proof: null,
      };
    });

    const orderIds = orders.map((r) => r.id).filter(Boolean);
    if (orderIds.length > 0) {
      try {
        const { data: proofRows } = await supabase
          .from("order_proofs")
          .select("store_order_id, status, token, round")
          .in("store_order_id", orderIds)
          .order("round", { ascending: false });
        const latestProofByOrder = new Map<string, { status: OrderProofStatus; token: string }>();
        for (const pr of proofRows ?? []) {
          const oid = String(pr.store_order_id ?? "").trim();
          if (!oid || latestProofByOrder.has(oid)) continue; // first (highest round) wins
          latestProofByOrder.set(oid, {
            status: normalizeProofStatus(pr.status),
            token: String(pr.token ?? "").trim(),
          });
        }
        for (const o of orders) {
          o.proof = latestProofByOrder.get(o.id) ?? null;
        }
      } catch {
        // order_proofs table may not exist yet (pre-migration) — proofs stay null.
      }
    }
    if (orderIds.length > 0) {
      const { data: itemRows } = await supabase
        .from("store_order_items")
        .select("order_id, product_name, quantity, line_total_cents, service_type, color, size, sort_order")
        .in("order_id", orderIds)
        .order("sort_order", { ascending: true });

      for (const line of itemRows ?? []) {
        const oid = line.order_id;
        if (!orderLineGroups[oid]) {
          orderLineGroups[oid] = [];
        }
        orderLineGroups[oid].push({
          product_name: line.product_name,
          quantity: line.quantity,
          line_total_cents: line.line_total_cents,
          service_type: line.service_type,
          color: line.color,
          size: line.size,
        });
      }
    }

    try {
      const quoteCutoffIso = customerQuoteRetentionCutoffIso();

      // Auto-expiry: purge this customer's quotes older than the retention window (best-effort), then
      // only ever list quotes newer than the cutoff so expired ones never appear even if a purge was missed.
      try {
        await supabase
          .from("customer_quotes")
          .delete()
          .ilike("customer_email", ilikeExact)
          .lt("created_at", quoteCutoffIso);
      } catch {
        // Purge is best-effort; the read filter below still hides expired quotes.
      }

      const { data: quoteRows } = await supabase
        .from("customer_quotes")
        .select(
          "id, quote_number, total_cents, total_quantity, currency, created_at, logo_setup_cents, delivery_cents, lines",
        )
        .ilike("customer_email", ilikeExact)
        .gte("created_at", quoteCutoffIso)
        .order("created_at", { ascending: false })
        .limit(MY_ACCOUNT_ORDERED_RECORDS_LIMIT);

      const toNum = (v: unknown) =>
        typeof v === "number" && Number.isFinite(v) ? v : Number(v) || 0;

      // Stage 1: parse the saved snapshot lines for each quote.
      const staged = (quoteRows ?? []).map((r) => {
        const rawLines = Array.isArray(r.lines) ? (r.lines as Record<string, unknown>[]) : [];
        const snapshotLines = rawLines.map((line) => ({
          productId: String(line.productId ?? "").trim() || undefined,
          productName: String(line.productName ?? "").trim() || "—",
          serviceType: String(line.serviceType ?? "").trim() || undefined,
          color: String(line.color ?? "").trim() || undefined,
          size: String(line.size ?? "").trim() || undefined,
          quantity: toNum(line.quantity),
          listUnitPrice: typeof line.listUnitPrice === "number" ? line.listUnitPrice : undefined,
          unitPrice: typeof line.unitPrice === "number" ? line.unitPrice : 0,
          totalPrice: typeof line.totalPrice === "number" ? line.totalPrice : undefined,
          specialDealPackageId: String(line.specialDealPackageId ?? "").trim() || undefined,
          productBaseUnit: typeof line.productBaseUnit === "number" ? line.productBaseUnit : undefined,
        }));
        return {
          id: String(r.id ?? ""),
          quote_number: String(r.quote_number ?? "").trim() || "—",
          currency: String(r.currency ?? "AUD").trim() || "AUD",
          created_at: String(r.created_at ?? "").trim() || new Date(0).toISOString(),
          storedTotalCents: toNum(r.total_cents),
          storedQuantity: toNum(r.total_quantity),
          logoSetupCents: toNum(r.logo_setup_cents),
          deliveryCents: toNum(r.delivery_cents),
          snapshotLines,
        };
      });

      // Stage 2: look up current product prices once for all quote lines.
      const productIds = [
        ...new Set(
          staged
            .flatMap((q) => q.snapshotLines.map((l) => (l.productId ?? "").trim()))
            .filter((id) => /^[0-9a-f-]{36}$/i.test(id)),
        ),
      ];
      const currentUnitByProductId = new Map<string, number>();
      if (productIds.length > 0) {
        const { data: productRows } = await supabase
          .from("products")
          .select("id, name, base_price, sale_price")
          .in("id", productIds);
        for (const row of productRows ?? []) {
          const unit = currentProductUnitFromRow(row);
          if (unit != null) {
            currentUnitByProductId.set(String(row.id), unit);
          }
        }
      }

      // Stage 3: reprice the product portion live; keep logo setup + delivery as saved.
      quotes = staged.map((q) => {
        const repriced = repriceQuoteLines(q.snapshotLines, currentUnitByProductId);
        const liveTotalCents = repriced.productTotalCents + q.logoSetupCents + q.deliveryCents;
        return {
          id: q.id,
          quote_number: q.quote_number,
          total_cents: liveTotalCents,
          total_quantity: repriced.totalQuantity || q.storedQuantity,
          currency: q.currency,
          created_at: q.created_at,
          price_updated: repriced.changed,
          lines: q.snapshotLines.map((line) => ({
            product_name: line.productName ?? "—",
            quantity: line.quantity,
            service_type: line.serviceType ?? "",
            color: line.color ?? "",
            size: line.size ?? "",
          })),
        };
      });
    } catch {
      quotes = [];
    }
  } catch {
    profile = null;
    orders = [];
    orderLineGroups = {};
    orderQueryIncludesInvoiceReference = false;
    storeCreditBalanceCents = 0;
    quotes = [];
  }

  const canChangePassword =
    profile !== null &&
    (Boolean(profile.auth_user_id) || Boolean(profile.login_password?.trim()));

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <MainWithSupplierRail>
        <div className={`${SITE_PAGE_ROW_CLASS} py-10`}>
          <div className="mx-auto w-full max-w-[70%] space-y-10">
          <header className="flex items-start justify-between gap-6">
            <div className="min-w-0 space-y-3">
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-[1.05rem] font-semibold text-brand-orange"
              >
                <ArrowLeftIcon className="h-[1.2rem] w-[1.2rem] shrink-0" />
                Back to home
              </Link>
              <h1 className="text-[2.25rem] font-medium leading-tight">My account</h1>
              <p className="text-[1.05rem] text-brand-navy/70">
                {sessionName ? `Signed in as ${sessionName}.` : "Manage your profile, password, and orders."}
              </p>
            </div>
            {masterLogoUrl ? (
              <div className="flex max-w-[40%] shrink-0 flex-col items-end gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={masterLogoUrl}
                  alt="Master logo"
                  className="h-auto max-h-[6.3rem] w-auto max-w-full rounded-xl border border-brand-navy/10 bg-white object-contain"
                  loading="lazy"
                />
                <a
                  href={`mailto:${STOREFRONT_QUOTE_EMAIL_RECIPIENT}?subject=${encodeURIComponent(
                    "Master Logo change request",
                  )}&body=${encodeURIComponent(
                    `Hi Boss Workwear team,\n\nI would like to change my saved Master Logo.\n\nAccount: ${
                      sessionName || ""
                    } (${sessionEmail})\n\nPlease attach or describe the new logo below:\n\n\nThanks,`,
                  )}`}
                  className="text-right text-[0.95rem] font-semibold text-brand-orange hover:underline"
                >
                  Want to change the Master Logo?
                </a>
              </div>
            ) : null}
          </header>

          {params.placed ? (
            <div
              className="rounded-2xl border border-emerald-200/80 bg-emerald-50/60 p-5 text-emerald-900 shadow-sm"
              role="status"
            >
              <ClearCartOnPlaced />
              <p className="text-[1.1rem] font-semibold">Thanks for your order!</p>
              <p className="mt-1 text-[1rem] text-emerald-900/80">
                Your order ID <span className="font-mono font-semibold">{params.placed}</span> is confirmed. A receipt
                and tracking link are on the way to your email, and your order is listed below.
              </p>
            </div>
          ) : null}

          <CustomerDetailPasswordPopovers
            profile={profile}
            passwordStatus={passwordStatus}
            canChangePassword={canChangePassword}
          />

          <section
            className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-6 shadow-sm"
            aria-labelledby="store-credit-heading"
          >
            <h2 id="store-credit-heading" className="text-[1.35rem] font-semibold text-brand-navy">
              Store credit
            </h2>
            <p className="mt-3 text-[2rem] font-medium tabular-nums text-brand-navy">
              {formatMoneyFromCents(storeCreditBalanceCents, "AUD")}
            </p>
            <p className="mt-2 text-[1.05rem] leading-relaxed text-brand-navy/70">
              {storeCreditBalanceCents > 0
                ? "This balance is applied automatically when you pay for your next order (up to the order total)."
                : "You have no store credit on file. Credit issued after a return or adjustment will appear here."}
            </p>
          </section>

          <section id="my-quotes" className="scroll-mt-[calc(var(--site-header-height)+1rem)] space-y-4">
            <h2 className="text-[1.62rem] font-semibold text-brand-navy">My Quote</h2>
            <div className="space-y-2 text-[1.26rem] text-brand-navy/70">
              <p className="flex gap-2">
                <span className="shrink-0 select-none font-semibold text-brand-navy/45" aria-hidden>
                  ·
                </span>
                <span>Quotes you emailed yourself from the cart are saved here.</span>
              </p>
              <p className="flex gap-2">
                <span className="shrink-0 select-none font-semibold text-brand-navy/45" aria-hidden>
                  ·
                </span>
                <span>
                  Use <span className="font-medium text-brand-navy/80">Order</span> to load a quote into your cart, then
                  continue to payment.
                </span>
              </p>
              <p className="flex gap-2">
                <span className="shrink-0 select-none font-semibold text-brand-navy/45" aria-hidden>
                  ·
                </span>
                <span>
                  Totals shown here reflect <span className="font-medium text-brand-navy/80">current</span> product
                  prices and pricing rules. Saved quotes are indicative only and are not a guaranteed price — the price
                  on the day you place your order may differ from the price on the day the quote was created. See our{" "}
                  <Link href="/terms-and-conditions" className="font-semibold text-brand-orange hover:underline">
                    Terms &amp; Conditions
                  </Link>
                  .
                </span>
              </p>
              <p className="flex gap-2">
                <span className="shrink-0 select-none font-semibold text-brand-navy/45" aria-hidden>
                  ·
                </span>
                <span>
                  Quotes are kept for {CUSTOMER_QUOTE_RETENTION_DAYS} days and then removed automatically. You can also{" "}
                  <span className="font-medium text-brand-navy/80">Delete</span> a quote anytime.
                </span>
              </p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-brand-navy/10 bg-brand-surface/50">
              {quotes.length === 0 ? (
                <p className="p-6 text-[1.26rem] text-brand-navy/70">
                  No quotes yet. Send yourself a quote from the cart to see it here.
                </p>
              ) : (
                <table className="w-full min-w-[52rem] border-collapse text-left text-[1.26rem]">
                  <thead>
                    <tr className="border-b border-brand-navy/10 bg-white/80 text-[1.08rem] font-semibold uppercase tracking-wide text-brand-navy/60">
                      <th className="px-4 py-3">Quote no.</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Items</th>
                      <th className="px-4 py-3">Lines</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Order</th>
                      <th className="px-4 py-3">Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotes.map((q) => (
                      <Fragment key={q.id}>
                        <tr className="border-b border-brand-navy/5">
                          <td className="px-4 py-3 font-mono font-medium text-brand-navy">{q.quote_number}</td>
                          <td className="px-4 py-3 text-brand-navy/80">{formatOrderDate(q.created_at)}</td>
                          <td className="px-4 py-3 text-brand-navy/80">{q.total_quantity}</td>
                          <td className="px-4 py-3 text-brand-navy/80">{q.lines.length}</td>
                          <td className="px-4 py-3 text-brand-navy">
                            {formatMoneyFromCents(q.total_cents, q.currency)}
                            {q.price_updated ? (
                              <span
                                className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[0.85rem] font-semibold text-amber-700"
                                title="Product prices changed since this quote was saved. This total reflects current pricing."
                              >
                                Updated
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 align-top">
                            <OrderFromQuoteButton quoteId={q.id} />
                          </td>
                          <td className="px-4 py-3 align-top">
                            <DeleteQuoteButton quoteId={q.id} quoteNumber={q.quote_number} />
                          </td>
                        </tr>
                        <tr className="border-b border-brand-navy/10 bg-white/40">
                          <td colSpan={7} className="px-4 py-2">
                            <details className="group">
                              <summary className="cursor-pointer list-none text-[1.26rem] font-semibold text-brand-navy/80 marker:content-none [&::-webkit-details-marker]:hidden">
                                <span className="underline decoration-brand-navy/25 decoration-1 underline-offset-2 group-open:text-brand-orange">
                                  Line items ({q.lines.length})
                                </span>
                              </summary>
                              {q.lines.length === 0 ? (
                                <p className="mt-2 pl-1 text-[1.26rem] text-brand-navy/55">No line details stored.</p>
                              ) : (
                                <ul className="mt-3 space-y-2 border-l-2 border-brand-orange/30 pl-4 text-[1.26rem]">
                                  {q.lines.map((line, idx) => {
                                    const bits = [line.service_type, line.color, line.size]
                                      .map((s) => String(s ?? "").trim())
                                      .filter(Boolean);
                                    return (
                                      <li key={`${q.id}-${idx}`} className="text-brand-navy/90">
                                        <span className="font-medium text-brand-navy">{line.product_name}</span>
                                        <span className="text-brand-navy/65"> × {line.quantity}</span>
                                        {bits.length > 0 ? (
                                          <span className="text-brand-navy/55"> · {bits.join(" · ")}</span>
                                        ) : null}
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </details>
                          </td>
                        </tr>
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section id="ordered-records" className="scroll-mt-[calc(var(--site-header-height)+1rem)] space-y-4">
            <h2 className="text-[1.62rem] font-semibold text-brand-navy">Ordered records</h2>
            <div className="space-y-2 text-[1.26rem] text-brand-navy/70">
              <p className="flex gap-2">
                <span className="shrink-0 select-none font-semibold text-brand-navy/45" aria-hidden>
                  ·
                </span>
                <span>Past store orders are listed below.</span>
              </p>
              <p className="flex gap-2">
                <span className="shrink-0 select-none font-semibold text-brand-navy/45" aria-hidden>
                  ·
                </span>
                <span>
                  Open <span className="font-medium text-brand-navy/80">Line items</span> to review what you bought.
                </span>
              </p>
              <p className="flex gap-2">
                <span className="shrink-0 select-none font-semibold text-brand-navy/45" aria-hidden>
                  ·
                </span>
                <span>
                  The <span className="font-medium text-brand-navy/80">Download</span> link in the Invoice column saves
                  an A4 tax invoice as a PDF once your invoice number has been added to the order.
                </span>
              </p>
              <p className="flex gap-2">
                <span className="shrink-0 select-none font-semibold text-brand-navy/45" aria-hidden>
                  ·
                </span>
                <span>
                  Use <span className="font-medium text-brand-navy/80">Reorder</span> to load this order into your cart
                  (you can remove lines there), then continue to payment for a new order.
                </span>
              </p>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-brand-navy/10 bg-brand-surface/50">
              {orders.length === 0 ? (
                <p className="p-6 text-[1.26rem] text-brand-navy/70">
                  No orders yet. Your completed store orders will appear here.
                </p>
              ) : (
                <table className="w-full min-w-[62rem] border-collapse text-left text-[1.26rem]">
                  <thead>
                    <tr className="border-b border-brand-navy/10 bg-white/80 text-[1.08rem] font-semibold uppercase tracking-wide text-brand-navy/60">
                      <th className="px-4 py-3">Customer order ID</th>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Lines</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Detail & Track</th>
                      <th className="px-4 py-3">Invoice</th>
                      <th className="px-4 py-3">Reorder</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((row) => {
                      const lines = orderLineGroups[row.id] ?? [];
                      const canDownloadTaxInvoice =
                        !orderQueryIncludesInvoiceReference || (row.invoice_reference ?? "").trim().length > 0;
                      return (
                        <Fragment key={row.id}>
                          <tr className="border-b border-brand-navy/5">
                            <td className="px-4 py-3 font-mono font-medium text-brand-navy">{row.order_number}</td>
                            <td className="px-4 py-3 text-brand-navy/80">{formatOrderDate(row.created_at)}</td>
                            <td className="px-4 py-3 capitalize text-brand-navy/80">{row.status}</td>
                            <td className="px-4 py-3 text-brand-navy/80">{lines.length}</td>
                            <td className="px-4 py-3 text-brand-navy">
                              {formatMoneyFromCents(row.total_cents, row.currency)}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={`/orders/track/${row.tracking_token}`}
                                className="font-semibold text-brand-orange hover:underline"
                              >
                                Detail & Track
                              </Link>
                              {row.proof ? (
                                row.proof.status === "sent" && row.proof.token ? (
                                  <a
                                    href={proofApproveUrl(row.id, row.proof.token)}
                                    className="mt-1 inline-flex items-center rounded-full border border-amber-300 bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                                  >
                                    Review proof →
                                  </a>
                                ) : (
                                  <span
                                    className={`mt-1 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                                      row.proof.status === "approved"
                                        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                        : "border-amber-200 bg-amber-50 text-amber-900"
                                    }`}
                                  >
                                    Proof: {proofStatusLabel(row.proof.status)}
                                  </span>
                                )
                              ) : null}
                            </td>
                            <td className="px-4 py-3">
                              {canDownloadTaxInvoice ? (
                                <a
                                  href={`/api/orders/tax-invoice?orderId=${encodeURIComponent(row.id)}`}
                                  className="font-semibold text-brand-orange hover:underline"
                                >
                                  Download
                                </a>
                              ) : (
                                <span
                                  className="font-semibold text-brand-navy/35 cursor-not-allowed select-none"
                                  title="Available once your invoice number has been added to this order."
                                >
                                  Download
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 align-top">
                              <ReorderOrderButton orderId={row.id} />
                            </td>
                          </tr>
                          <tr className="border-b border-brand-navy/10 bg-white/40">
                            <td colSpan={8} className="px-4 py-2">
                              <details className="group">
                                <summary className="cursor-pointer list-none text-[1.26rem] font-semibold text-brand-navy/80 marker:content-none [&::-webkit-details-marker]:hidden">
                                  <span className="underline decoration-brand-navy/25 decoration-1 underline-offset-2 group-open:text-brand-orange">
                                    Line items ({lines.length})
                                  </span>
                                </summary>
                                {lines.length === 0 ? (
                                  <p className="mt-2 pl-1 text-[1.26rem] text-brand-navy/55">No line details stored.</p>
                                ) : (
                                  <ul className="mt-3 space-y-2 border-l-2 border-brand-orange/30 pl-4 text-[1.26rem]">
                                    {lines.map((line, idx) => {
                                      const bits = [line.service_type, line.color, line.size]
                                        .map((s) => String(s ?? "").trim())
                                        .filter(Boolean);
                                      return (
                                        <li key={`${row.id}-${idx}`} className="text-brand-navy/90">
                                          <span className="font-medium text-brand-navy">{line.product_name}</span>
                                          <span className="text-brand-navy/65"> × {line.quantity}</span>
                                          {bits.length > 0 ? (
                                            <span className="text-brand-navy/55"> · {bits.join(" · ")}</span>
                                          ) : null}
                                          <span className="ml-2 text-brand-navy/75">
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
              )}
            </div>
          </section>
          </div>
        </div>
      </MainWithSupplierRail>
    </main>
  );
}
