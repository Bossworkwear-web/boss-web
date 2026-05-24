import Link from "next/link";

import { LEGAL_PAGE_LABELS, LEGAL_PAGE_PATHS, LEGAL_PAGE_SLUGS, getLegalPageCmsHtml } from "@/lib/site-content";

export default async function AdminSiteLegalIndexPage() {
  const rows = await Promise.all(
    LEGAL_PAGE_SLUGS.map(async (slug) => ({
      slug,
      label: LEGAL_PAGE_LABELS[slug],
      path: LEGAL_PAGE_PATHS[slug],
      hasCustom: Boolean((await getLegalPageCmsHtml(slug))?.trim()),
    })),
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin/site" className="text-brand-orange hover:underline">
            Site &amp; content
          </Link>{" "}
          / Legal pages
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Legal pages</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Paste HTML for a page to replace the built-in storefront copy. Leave a page empty to keep the default content
          in the codebase.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Page</th>
              <th className="px-4 py-3">Storefront</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-brand-navy">{row.label}</td>
                <td className="px-4 py-3">
                  <a href={row.path} target="_blank" rel="noreferrer" className="text-brand-orange hover:underline">
                    {row.path}
                  </a>
                </td>
                <td className="px-4 py-3 text-slate-600">{row.hasCustom ? "Custom (Supabase)" : "Built-in default"}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/site/legal/${row.slug}`}
                    className="rounded-lg border border-brand-navy/15 px-3 py-1.5 text-xs font-semibold text-brand-navy hover:bg-brand-surface/40"
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
