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
  else if (errorKey === "missing_contact") errorMessage = "Enter a phone number.";
  else if (errorKey === "no_items") errorMessage = "Add at least one garment / service line.";
  else if (errorKey) errorMessage = decodeError(errorKey);

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <MainWithSupplierRail>
        <section className={`${SITE_PAGE_ROW_CLASS} py-10`}>
          <div className="mx-auto w-full max-w-[67.2rem] space-y-6">
            <header className="space-y-2 print:hidden">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-brand-orange">Staff only</p>
              <h1 className="text-3xl font-medium text-brand-navy">Instore order</h1>
              <p className="text-sm leading-relaxed text-brand-navy/70">
                Walk-in printing or embroidery jobs. Staff login is required. Saved to{" "}
                <strong>Admin → Instore orders</strong> — not synced to Xero. Customers cannot see this page; bookmark
                the URL for floor staff.
              </p>
            </header>

            {created ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 print:hidden">
                Order saved: <span className="font-mono font-semibold">{created}</span>. View in{" "}
                <Link href="/admin/instore-orders" className="font-semibold text-brand-orange hover:underline">
                  Admin → Instore orders
                </Link>
                .
              </div>
            ) : null}

            {errorMessage ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 print:hidden">
                {errorMessage}
              </div>
            ) : null}

            <InstoreOrderForm savedOrderNumber={created || undefined} />
          </div>
        </section>
      </MainWithSupplierRail>
    </main>
  );
}
