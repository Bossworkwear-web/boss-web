import Link from "next/link";
import { notFound } from "next/navigation";

import {
  LEGAL_PAGE_LABELS,
  LEGAL_PAGE_PATHS,
  LEGAL_PAGE_SLUGS,
  getLegalPageCmsHtml,
  type LegalPageSlug,
} from "@/lib/site-content";

import { saveLegalPageContent } from "../../actions";

type Search = {
  saved?: string;
  error?: string;
};

function isLegalSlug(raw: string): raw is LegalPageSlug {
  return (LEGAL_PAGE_SLUGS as readonly string[]).includes(raw);
}

export default async function AdminSiteLegalEditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Search>;
}) {
  const { slug: rawSlug } = await params;
  if (!isLegalSlug(rawSlug)) {
    notFound();
  }
  const slug = rawSlug;
  const q = await searchParams;
  const existing = (await getLegalPageCmsHtml(slug)) ?? "";

  let banner: { kind: "ok" | "err"; text: string } | null = null;
  if (q.saved === "1") banner = { kind: "ok", text: "Legal page saved." };
  else if (q.error === "empty_body") banner = { kind: "err", text: "Body cannot be empty. Use “Reset to built-in” to remove custom content." };
  else if (q.error) {
    try {
      banner = { kind: "err", text: decodeURIComponent(q.error.replace(/\+/g, " ")) };
    } catch {
      banner = { kind: "err", text: q.error };
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin/site/legal" className="text-brand-orange hover:underline">
            Legal pages
          </Link>{" "}
          / {LEGAL_PAGE_LABELS[slug]}
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">{LEGAL_PAGE_LABELS[slug]}</h1>
        <p className="mt-2 text-sm text-slate-600">
          Storefront:{" "}
          <a href={LEGAL_PAGE_PATHS[slug]} target="_blank" rel="noreferrer" className="text-brand-orange hover:underline">
            {LEGAL_PAGE_PATHS[slug]}
          </a>
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

      <form action={saveLegalPageContent} className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <input type="hidden" name="slug" value={slug} />
        <label className="grid gap-2 text-sm">
          <span className="font-semibold text-brand-navy">HTML body</span>
          <span className="text-slate-600">
            Use headings, paragraphs, and links. This replaces the built-in page when saved.
          </span>
          <textarea
            name="body"
            defaultValue={existing}
            rows={24}
            className="font-mono rounded-md border border-slate-200 px-3 py-2 text-xs leading-relaxed"
            placeholder="<p>Your policy text…</p>"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-lg bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy hover:brightness-95"
          >
            Save custom page
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
