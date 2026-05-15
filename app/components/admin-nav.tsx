"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import type { AdminPortalNavAccess } from "@/lib/admin-portal-permissions";
import { isAdminPathAllowedForPortalAccess } from "@/lib/admin-portal-permissions";

const LINKS = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/customer-info", label: "Customer Info" },
  { href: "/admin/customer-quote", label: "Customer Quote" },
  { href: "/admin/store-orders", label: "Store Orders" },
  { href: "/admin/supplier-orders", label: "Supplier orders" },
  { href: "/admin/work-process", label: "Click Up" },
  { href: "/admin/incoming-goods", label: "Incoming goods" },
  { href: "/admin/production", label: "Production" },
  { href: "/admin/quality-control", label: "Quality Control" },
  { href: "/admin/dispatch", label: "Dispatch" },
  { href: "/admin/complete-orders", label: "Completed Order" },
  { href: "/admin/warehouse", label: "Warehouse" },
  { href: "/admin/stock", label: "Stock" },
  { href: "/admin/clearance-stock", label: "Clearance Stock" },
  { href: "/admin/crm", label: "CRM & Pipeline" },
  { href: "/admin/promotion", label: "Promotion" },
  { href: "/admin/storefront-chat", label: "Storefront chat" },
  { href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/accounting", label: "Accounting" },
  { href: "/admin/customer-invoices", label: "Customer Invoices" },
  { href: "/admin/accounting/access-control", label: "Access control" },
  { href: "/admin/site", label: "Site & content" },
] as const;

const GREEN_NAV_END_HREF = "/admin/incoming-goods";

const GREEN_NAV_HREFS = new Set(
  LINKS.slice(0, LINKS.findIndex((l) => l.href === GREEN_NAV_END_HREF) + 1).map((l) => l.href),
);

const CYAN_NAV_START_HREF = "/admin/production";
const CYAN_NAV_END_HREF = "/admin/complete-orders";

const CYAN_NAV_HREFS = new Set(
  LINKS.slice(
    LINKS.findIndex((l) => l.href === CYAN_NAV_START_HREF),
    LINKS.findIndex((l) => l.href === CYAN_NAV_END_HREF) + 1,
  ).map((l) => l.href),
);

const RED_NAV_START_HREF = "/admin/warehouse";
const RED_NAV_END_HREF = "/admin/clearance-stock";

const RED_NAV_HREFS = new Set(
  LINKS.slice(
    LINKS.findIndex((l) => l.href === RED_NAV_START_HREF),
    LINKS.findIndex((l) => l.href === RED_NAV_END_HREF) + 1,
  ).map((l) => l.href),
);

const YELLOW_NAV_START_HREF = "/admin/crm";
const YELLOW_NAV_END_HREF = "/admin/reports";

const YELLOW_NAV_HREFS = new Set(
  LINKS.slice(
    LINKS.findIndex((l) => l.href === YELLOW_NAV_START_HREF),
    LINKS.findIndex((l) => l.href === YELLOW_NAV_END_HREF) + 1,
  ).map((l) => l.href),
);

const PURPLE_NAV_START_HREF = "/admin/accounting";
const PURPLE_NAV_END_HREF = "/admin/site";

const PURPLE_NAV_HREFS = new Set(
  LINKS.slice(
    LINKS.findIndex((l) => l.href === PURPLE_NAV_START_HREF),
    LINKS.findIndex((l) => l.href === PURPLE_NAV_END_HREF) + 1,
  ).map((l) => l.href),
);

function adminNavLinkClass(href: string, active: boolean): string {
  const base = "rounded-xl px-[1.125rem] py-[0.9375rem] text-[1.05rem] font-semibold leading-snug transition";
  if (GREEN_NAV_HREFS.has(href)) {
    return `${base} ${
      active ? "bg-green-300 text-brand-navy" : "bg-green-400 text-brand-navy hover:bg-green-300"
    }`;
  }
  if (CYAN_NAV_HREFS.has(href)) {
    return `${base} ${
      active ? "bg-cyan-300 text-brand-navy" : "bg-cyan-400 text-brand-navy hover:bg-cyan-300"
    }`;
  }
  if (RED_NAV_HREFS.has(href)) {
    return `${base} ${
      active ? "bg-red-300 text-brand-navy" : "bg-red-400 text-brand-navy hover:bg-red-300"
    }`;
  }
  if (YELLOW_NAV_HREFS.has(href)) {
    return `${base} ${
      active ? "bg-yellow-300 text-brand-navy" : "bg-yellow-400 text-brand-navy hover:bg-yellow-300"
    }`;
  }
  if (PURPLE_NAV_HREFS.has(href)) {
    return `${base} ${
      active ? "bg-purple-300 text-brand-navy" : "bg-purple-400 text-brand-navy hover:bg-purple-300"
    }`;
  }
  return `${base} ${active ? "bg-brand-orange text-brand-navy" : "text-slate-200 hover:bg-slate-800"}`;
}

export function AdminNav({ portalAccess }: { portalAccess: AdminPortalNavAccess }) {
  const pathname = usePathname();
  const router = useRouter();

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const visibleLinks = useMemo(() => {
    if (portalAccess.mode === "full") return [...LINKS];
    return LINKS.filter((item) => isAdminPathAllowedForPortalAccess(portalAccess, item.href));
  }, [portalAccess]);

  // Avoid hydration mismatch: `usePathname()` can be empty/unstable during the server render.
  const activeHref = useMemo(() => {
    if (!mounted || !pathname) return null;
    let best = visibleLinks[0]?.href ?? "/admin";
    for (const item of visibleLinks) {
      const href = item.href;
      if (pathname === href) {
        if (href.length > best.length) best = href;
        continue;
      }
      if (href !== "/admin" && (pathname === href || pathname.startsWith(`${href}/`))) {
        if (href.length > best.length) best = href;
      }
    }
    return best;
  }, [mounted, pathname, visibleLinks]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <aside className="fixed bottom-0 left-0 top-0 z-40 hidden w-[calc(306px*0.7)] flex-col border-r border-slate-700 bg-slate-900 text-white lg:flex">
      <div className="shrink-0 border-b border-slate-700 px-6 py-8">
        <p className="text-[1.125rem] font-semibold uppercase tracking-[0.12em] text-slate-400">Admin</p>
        <p className="mt-1 text-[1.6875rem] font-medium leading-tight">Boss Web</p>
      </div>
      <nav
        className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overflow-x-hidden p-4 overscroll-contain"
        aria-label="Admin sections"
      >
        {visibleLinks.map((item) => {
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
              <Link href={item.href} className={adminNavLinkClass(item.href, active)}>
                {item.label}
              </Link>
            </Fragment>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-slate-700 bg-slate-900 p-4">
        <Link
          href="/"
          className="mb-2 block rounded-xl px-[1.125rem] py-[0.9375rem] text-[1.05rem] font-semibold text-slate-300 hover:bg-slate-800"
        >
          View storefront
        </Link>
        <button
          type="button"
          onClick={() => void logout()}
          className="w-full rounded-xl px-[1.125rem] py-[0.9375rem] text-left text-[1.05rem] font-semibold text-red-300 hover:bg-slate-800"
        >
          Log out
        </button>
      </div>
    </aside>
  );
}
