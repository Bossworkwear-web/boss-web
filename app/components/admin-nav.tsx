"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/store-orders", label: "Store orders" },
  { href: "/admin/supplier-orders", label: "Supplier orders" },
  { href: "/admin/work-process", label: "Click Up" },
  { href: "/admin/production", label: "Production" },
  { href: "/admin/quality-control", label: "Quality Control" },
  { href: "/admin/dispatch", label: "Dispatch" },
  { href: "/admin/complete-orders", label: "Complete Orders" },
  { href: "/admin/warehouse", label: "Warehouse" },
  { href: "/admin/stock", label: "Stock" },
  { href: "/admin/clearance-stock", label: "Clearance Stock" },
  { href: "/admin/crm", label: "CRM & Pipeline" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/accounting", label: "Accounting" },
  { href: "/admin/accounting/access-control", label: "Access control" },
  { href: "/admin/site", label: "Site & content" },
] as const;

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Avoid hydration mismatch: `usePathname()` can be empty/unstable during the server render.
  // We only compute the active link after mount so SSR + first client paint match.
  const activeHref = useMemo(() => {
    if (!mounted || !pathname) return null;
    let best = "/admin";
    for (const item of LINKS) {
      const href = item.href;
      if (pathname === href) {
        if (href.length > best.length) best = href;
        continue;
      }
      // Match nested routes, but ensure we don't treat "/admin/x-y" as "/admin/x".
      if (href !== "/admin" && (pathname === href || pathname.startsWith(`${href}/`))) {
        if (href.length > best.length) best = href;
      }
    }
    return best;
  }, [mounted, pathname]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-[306px] flex-col border-r border-slate-700 bg-slate-900 text-white lg:flex">
      <div className="shrink-0 border-b border-slate-700 px-6 py-8">
        <p className="text-[1.125rem] font-semibold uppercase tracking-[0.12em] text-slate-400">Admin</p>
        <p className="mt-1 text-[1.6875rem] font-medium leading-tight">Boss Web</p>
      </div>
      <nav
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-4 overscroll-contain"
        aria-label="Admin sections"
      >
        {LINKS.map((item) => {
          const active = activeHref ? item.href === activeHref : false;
          return (
            <Fragment key={item.href}>
              {item.href === "/admin/production" && (
                <div className="mx-2 my-2 h-px shrink-0 bg-white" aria-hidden />
              )}
              {item.href === "/admin/accounting" && (
                <div className="mx-2 my-2 h-px shrink-0 bg-white" aria-hidden />
              )}
              {item.href === "/admin/crm" && (
                <div className="mx-2 my-2 h-px shrink-0 bg-white" aria-hidden />
              )}
              {item.href === "/admin/warehouse" && (
                <div className="mx-2 my-2 h-px shrink-0 bg-white" aria-hidden />
              )}
              <Link
                href={item.href}
                className={`rounded-xl px-[1.125rem] py-[0.9375rem] text-[1.3125rem] font-semibold leading-snug transition ${
                  active ? "bg-brand-orange text-brand-navy" : "text-slate-200 hover:bg-slate-800"
                }`}
              >
                {item.label}
              </Link>
            </Fragment>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-slate-700 bg-slate-900 p-4">
        <Link
          href="/"
          className="mb-2 block rounded-xl px-[1.125rem] py-[0.9375rem] text-[1.3125rem] font-semibold text-slate-300 hover:bg-slate-800"
        >
          View storefront
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full rounded-xl px-[1.125rem] py-[0.9375rem] text-left text-[1.3125rem] font-semibold text-red-300 hover:bg-slate-800"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
