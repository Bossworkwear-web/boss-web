import { GOOGLE_MARKETING_LINKS } from "@/lib/google-marketing-links";

type AdminGoogleMarketingLinksProps = {
  /** Dashboard: tighter grid; Analytics: full cards with domain hint. */
  variant?: "dashboard" | "analytics";
};

export function AdminGoogleMarketingLinks({ variant = "analytics" }: AdminGoogleMarketingLinksProps) {
  const links = [GOOGLE_MARKETING_LINKS.ga4, GOOGLE_MARKETING_LINKS.searchConsole];

  if (variant === "dashboard") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-orange/40 hover:shadow-md"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">{link.label}</p>
            <p className="mt-2 text-lg font-medium text-brand-navy">{link.label} ↗</p>
            <p className="mt-1 text-xs text-slate-600">{link.description}</p>
          </a>
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-medium text-brand-navy">Google marketing</h2>
        <p className="mt-1 text-sm text-slate-600">
          Open GA4 and Search Console in a new tab. Storefront tags use{" "}
          <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_GA_MEASUREMENT_ID</code> when set on Vercel.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {links.map((link) => (
          <a
            key={link.label}
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[160px] flex-col rounded-xl border border-brand-orange/35 bg-brand-orange/5 p-6 transition hover:bg-brand-orange/10"
          >
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-600">{link.label}</p>
            <p className="mt-3 text-xl font-medium text-brand-navy">{link.label}</p>
            <p className="mt-2 flex-1 text-sm text-slate-600">{link.description}</p>
            <p className="mt-4 text-sm font-semibold text-brand-orange">Open in new tab ↗</p>
          </a>
        ))}
      </div>
    </section>
  );
}
