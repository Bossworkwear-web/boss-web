import Link from "next/link";
import type { Metadata } from "next";

import { InstoreOrderForm } from "@/app/instore_order/instore-order-form";
import { TopNav } from "@/app/components/top-nav";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Instore order",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<{ created?: string; error?: string }>;
};

function decodeError(raw: string): string {
  try {
    return decodeURIComponent(raw.replace(/\+/g, " "));
  } catch {
    return raw;
  }
}

export default async function InstoreOrderPage({ searchParams }: PageProps) {
  const q = await searchParams;
  const created = (q.created ?? "").trim();
  const errorKey = (q.error ?? "").trim();

  let errorMessage: string | null = null;
  if (errorKey === "missing_name") errorMessage = "Customer name is required.";
  else if (errorKey === "missing_contact") errorMessage = "Enter an email or phone number.";
  else if (errorKey === "no_items") errorMessage = "Add at least one garment / service line.";
  else if (errorKey) errorMessage = decodeError(errorKey);

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <MainWithSupplierRail>
        <section className={`${SITE_PAGE_ROW_CLASS} py-10`}>
          <div className="mx-auto w-full max-w-3xl space-y-6">
            <header className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-orange">Staff only</p>
              <h1 className="text-3xl font-medium text-brand-navy">Instore order</h1>
              <p className="text-sm leading-relaxed text-brand-navy/70">
                Walk-in printing or embroidery jobs. Saved to{" "}
                <strong>Admin → Instore orders</strong> — not synced to Xero. Customers cannot see this page; bookmark
                the URL for floor staff.
              </p>
              {process.env.NODE_ENV === "development" && process.env.INSTORE_ORDER_REQUIRE_AUTH !== "1" ? (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  Local dev: open{" "}
                  <a href="http://127.0.0.1:3000/instore_order" className="font-mono font-semibold text-brand-orange hover:underline">
                    http://127.0.0.1:3000/instore_order
                  </a>{" "}
                  — staff login not required on localhost.
                </p>
              ) : (
                <p className="text-xs text-brand-navy/50">
                  Not signed in?{" "}
                  <Link href="/admin/login?from=/instore_order" className="font-semibold text-brand-orange hover:underline">
                    Staff login
                  </Link>
                </p>
              )}
            </header>

            {created ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
                Order saved: <span className="font-mono font-semibold">{created}</span>. View in{" "}
                <Link href="/admin/instore-orders" className="font-semibold text-brand-orange hover:underline">
                  Admin → Instore orders
                </Link>
                .
              </div>
            ) : null}

            {errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {errorMessage}
              </div>
            ) : null}

            <InstoreOrderForm />
          </div>
        </section>
      </MainWithSupplierRail>
    </main>
  );
}
