import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Fragment } from "react";

import { ArrowLeftIcon } from "@/app/components/icons";
import { TopNav } from "@/app/components/top-nav";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { formatMoneyFromCents } from "@/lib/store-order-utils";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";
import { MY_ACCOUNT_ORDERED_RECORDS_LIMIT } from "@/lib/customer-ordered-records";

import { CustomerDetailPasswordPopovers } from "./customer-detail-password-popovers";
import { ReorderOrderButton } from "./reorder-order-button";

export const dynamic = "force-dynamic";

type CustomerPageProps = {
  searchParams: Promise<{ password?: string }>;
};

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

  try {
    const supabase = createSupabaseAdminClient();
    const { data: p } = await supabase
      .from("customer_profiles")
      .select(
        "customer_name, organisation, contact_number, email_address, delivery_address, billing_address, login_password",
      )
      .eq("email_address", emailNorm)
      .maybeSingle();
    profile = p;

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
      };
    });

    const orderIds = orders.map((r) => r.id).filter(Boolean);
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
  } catch {
    profile = null;
    orders = [];
    orderLineGroups = {};
    orderQueryIncludesInvoiceReference = false;
  }

  const canChangePassword =
    profile !== null && profile.login_password !== null && profile.login_password !== "";

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <MainWithSupplierRail>
        <div className={`${SITE_PAGE_ROW_CLASS} py-10`}>
          <div className="mx-auto w-full max-w-[70%] space-y-10">
          <header className="space-y-3">
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
          </header>

          <CustomerDetailPasswordPopovers
            profile={profile}
            passwordStatus={passwordStatus}
            canChangePassword={canChangePassword}
          />

          <section id="ordered-records" className="scroll-mt-[calc(var(--site-header-height)+1rem)] space-y-4">
            {masterLogoUrl ? (
              <div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={masterLogoUrl}
                  alt="Master logo"
                  className="h-[21rem] w-auto max-w-full rounded-xl border border-brand-navy/10 bg-white object-contain"
                  loading="lazy"
                />
              </div>
            ) : null}
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
