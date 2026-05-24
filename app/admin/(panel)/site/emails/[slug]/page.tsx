import Link from "next/link";
import { notFound } from "next/navigation";

import {
  DEFAULT_EMAIL_TEMPLATES,
  EMAIL_TEMPLATE_LABELS,
  EMAIL_TEMPLATE_PLACEHOLDERS,
  EMAIL_TEMPLATE_SLUGS,
  getEmailTemplateContent,
  getEmailTemplateOverrides,
  type EmailTemplateSlug,
} from "@/lib/store-email-templates";

import { saveEmailTemplateContent } from "../../actions";

type Search = {
  saved?: string;
  error?: string;
};

function isEmailTemplateSlug(raw: string): raw is EmailTemplateSlug {
  return (EMAIL_TEMPLATE_SLUGS as readonly string[]).includes(raw);
}

export default async function AdminSiteEmailEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
}) {
  const { slug: rawSlug } = await params;
  if (!isEmailTemplateSlug(rawSlug)) {
    notFound();
  }
  const slug = rawSlug;
  const q = await searchParams;
  const [effective, overrides] = await Promise.all([getEmailTemplateContent(slug), getEmailTemplateOverrides(slug)]);

  const subjectValue = overrides.subject ?? DEFAULT_EMAIL_TEMPLATES[slug].subject;
  const htmlValue = overrides.html ?? DEFAULT_EMAIL_TEMPLATES[slug].html;

  let banner: { kind: "ok" | "err"; text: string } | null = null;
  if (q.saved === "1") banner = { kind: "ok", text: "Email template saved." };
  else if (q.error === "missing_fields") banner = { kind: "err", text: "Subject and HTML body are required." };
  else if (q.error) {
    try {
      banner = { kind: "err", text: decodeURIComponent(q.error.replace(/\+/g, " ")) };
    } catch {
      banner = { kind: "err", text: q.error };
    }
  }

  const placeholders = EMAIL_TEMPLATE_PLACEHOLDERS[slug];

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin/site/emails" className="text-brand-orange hover:underline">
            Email templates
          </Link>{" "}
          / {EMAIL_TEMPLATE_LABELS[slug]}
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">{EMAIL_TEMPLATE_LABELS[slug]}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Effective subject: <code className="rounded bg-slate-100 px-1">{effective.subject}</code>
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

      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-semibold text-brand-navy">Placeholders</p>
        <p className="mt-1">
          {placeholders.map((key) => (
            <code key={key} className="mr-2 inline-block rounded bg-white px-1.5 py-0.5 text-xs">
              {`{{${key}}}`}
            </code>
          ))}
        </p>
      </div>

      <form action={saveEmailTemplateContent} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="slug" value={slug} />
        <label className="grid gap-2 text-sm">
          <span className="font-semibold text-brand-navy">Subject</span>
          <input
            name="subject"
            defaultValue={subjectValue}
            className="rounded-md border border-slate-200 px-3 py-2"
            placeholder="Order confirmed — {{orderNumber}}"
          />
        </label>
        <label className="grid gap-2 text-sm">
          <span className="font-semibold text-brand-navy">HTML body</span>
          <textarea
            name="html"
            defaultValue={htmlValue}
            rows={20}
            className="font-mono rounded-md border border-slate-200 px-3 py-2 text-xs leading-relaxed"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-95"
          >
            Save template
          </button>
          <button
            type="submit"
            name="clear"
            value="1"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Reset to built-in default
          </button>
        </div>
      </form>
    </div>
  );
}
