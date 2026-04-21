export default function AdminSitePage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-medium text-brand-navy">Site & content</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage hero copy, partner ads, featured categories, and legal pages. Prefer storing content in Supabase or a
          headless CMS for non-developer edits.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2">
        {[
          { title: "Homepage hero", desc: "Banner text, CTA, seasonal promo" },
          { title: "Category banners", desc: "Right-rail partner ad slots" },
          { title: "Terms & legal", desc: "Link to editable markdown or CMS" },
          { title: "Email templates", desc: "Order confirmation, shipping" },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="font-medium text-brand-navy">{item.title}</p>
            <p className="mt-2 text-sm text-slate-600">{item.desc}</p>
            <button
              type="button"
              disabled
              className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-400"
            >
              Configure (coming soon)
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
