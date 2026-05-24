import Link from "next/link";

import {
  EMAIL_TEMPLATE_DESCRIPTIONS,
  EMAIL_TEMPLATE_LABELS,
  EMAIL_TEMPLATE_SLUGS,
  getEmailTemplateOverrides,
} from "@/lib/store-email-templates";

export default async function AdminSiteEmailsIndexPage() {
  const rows = await Promise.all(
    EMAIL_TEMPLATE_SLUGS.map(async (slug) => {
      const overrides = await getEmailTemplateOverrides(slug);
      const hasCustom = Boolean(overrides.subject || overrides.html);
      return {
        slug,
        label: EMAIL_TEMPLATE_LABELS[slug],
        description: EMAIL_TEMPLATE_DESCRIPTIONS[slug],
        hasCustom,
      };
    }),
  );

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin/site" className="text-brand-orange hover:underline">
            Site &amp; content
          </Link>{" "}
          / Email templates
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Email templates</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Edit subject lines and HTML bodies for transactional store emails. Use placeholders like{" "}
          <code className="rounded bg-slate-100 px-1">{"{{orderNumber}}"}</code>. Reset to restore built-in defaults.
        </p>
      </header>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Template</th>
              <th className="px-4 py-3">When sent</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.slug} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-brand-navy">{row.label}</td>
                <td className="px-4 py-3 text-slate-600">{row.description}</td>
                <td className="px-4 py-3 text-slate-600">{row.hasCustom ? "Custom (Supabase)" : "Built-in default"}</td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/site/emails/${row.slug}`}
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
