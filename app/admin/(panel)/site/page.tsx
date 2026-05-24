import Link from "next/link";

import { HomepageHeroForm } from "./homepage-hero-form";
import { getHomepageHeroContent } from "@/lib/site-content";

type Search = {
  saved?: string;
  error?: string;
};

export default async function AdminSitePage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const hero = await getHomepageHeroContent();

  let banner: { kind: "ok" | "err"; text: string } | null = null;
  if (q.saved === "hero") banner = { kind: "ok", text: "Homepage hero saved." };
  else if (q.error === "missing_hero_fields") banner = { kind: "err", text: "All hero fields are required." };
  else if (q.error) {
    try {
      banner = { kind: "err", text: decodeURIComponent(q.error.replace(/\+/g, " ")) };
    } catch {
      banner = { kind: "err", text: q.error };
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          / Site &amp; content
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Site &amp; content</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Edit homepage copy and legal pages stored in Supabase. Other merchandising tools link out to their existing
          admin screens.
        </p>
      </header>

      {banner ? (
        <div
          className={
            banner.kind === "ok"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
              : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
          }
        >
          {banner.text}
        </div>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-brand-navy">Homepage hero</h2>
        <p className="mt-1 text-sm text-slate-600">Headline and subtext overlaid on the home carousel.</p>
        <div className="mt-4">
          <HomepageHeroForm initial={hero} />
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          {
            title: "Special deals / clearance",
            desc: "Published lines on /special-deals",
            href: "/admin/clearance-stock",
            label: "Manage clearance stock",
          },
          {
            title: "Promotion codes",
            desc: "Checkout discount codes",
            href: "/admin/promotion",
            label: "Manage promotions",
          },
          {
            title: "Terms & legal pages",
            desc: "Terms, privacy, shipping, returns (HTML)",
            href: "/admin/site/legal",
            label: "Edit legal pages",
          },
          {
            title: "Email templates",
            desc: "Order confirmation and shipping emails",
            href: "/admin/site/emails",
            label: "Edit email templates",
          },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium text-brand-navy">{item.title}</p>
            <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
            {item.href ? (
              <Link
                href={item.href}
                className="mt-4 inline-block rounded-lg border border-brand-navy/15 bg-brand-surface/40 px-3 py-1.5 text-xs font-semibold text-brand-navy hover:bg-brand-surface"
              >
                {item.label}
              </Link>
            ) : (
              <span className="mt-4 inline-block rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-400">
                {item.label}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
