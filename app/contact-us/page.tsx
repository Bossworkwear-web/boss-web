import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { TopNav } from "@/app/components/top-nav";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

export const dynamic = "force-dynamic";

export default function ContactUsPage() {
  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <MainWithSupplierRail>
        <section className={`${SITE_PAGE_ROW_CLASS} py-10`}>
        <header className="mb-8 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-navy/70">Contact</p>
          <h1 className="text-4xl font-medium">Contact us</h1>
          <p className="text-sm text-brand-navy/65">Get in touch with us. We’re here to help.</p>
        </header>

        <div className="space-y-6 rounded-2xl border border-brand-navy/10 bg-brand-surface/50 p-6">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-navy/70">Company name</p>
            <div className="min-h-[48px] rounded-lg border border-dashed border-brand-navy/20 bg-white px-3 py-2 text-sm text-brand-navy/50">
              Placeholder for company name
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-navy/70">Address</p>
            <div className="min-h-[80px] rounded-lg border border-dashed border-brand-navy/20 bg-white px-3 py-2 text-sm text-brand-navy/50">
              Placeholder for address (street, suburb, state, postcode)
            </div>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-navy/70">Phone</p>
              <div className="min-h-[48px] rounded-lg border border-dashed border-brand-navy/20 bg-white px-3 py-2 text-sm text-brand-navy/50">
                Placeholder for phone number
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-navy/70">Email</p>
              <div className="min-h-[48px] rounded-lg border border-dashed border-brand-navy/20 bg-white px-3 py-2 text-sm text-brand-navy/50">
                Placeholder for email address
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-navy/70">Business hours</p>
            <div className="min-h-[80px] rounded-lg border border-dashed border-brand-navy/20 bg-white px-3 py-2 text-sm text-brand-navy/50">
              Placeholder for business hours
            </div>
          </div>

          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-brand-navy/70">Additional info</p>
            <div className="min-h-[100px] rounded-lg border border-dashed border-brand-navy/20 bg-white px-3 py-2 text-sm text-brand-navy/50">
              Placeholder for any other company details or contact information
            </div>
          </div>
        </div>
        </section>
      </MainWithSupplierRail>
    </main>
  );
}
