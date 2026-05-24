import type { ReactNode } from "react";

import { CmsHtmlContent } from "@/app/components/cms-html-content";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { TopNav } from "@/app/components/top-nav";
import { getLegalPageCmsHtml, LEGAL_PAGE_LABELS, type LegalPageSlug } from "@/lib/site-content";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

type Props = {
  slug: LegalPageSlug;
  children: ReactNode;
  shell?: "plain" | "storefront";
};

export async function LegalPageWithCmsFallback({ slug, children, shell = "plain" }: Props) {
  const cmsHtml = await getLegalPageCmsHtml(slug);
  const title = LEGAL_PAGE_LABELS[slug];

  if (cmsHtml?.trim()) {
    const body = <CmsHtmlContent html={cmsHtml} />;
    if (shell === "storefront") {
      return (
        <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
          <TopNav />
          <MainWithSupplierRail>
            <section className={`${SITE_PAGE_ROW_CLASS} max-w-4xl py-10`}>
              <h1 className="mb-6 text-3xl font-medium">{title}</h1>
              {body}
            </section>
          </MainWithSupplierRail>
        </main>
      );
    }

    return (
      <main className="min-h-screen bg-white py-6 text-brand-navy sm:py-8 md:py-10">
        <div className={SITE_PAGE_ROW_CLASS}>
          <h1 className="mb-6 text-2xl font-medium">{title}</h1>
          {body}
        </div>
      </main>
    );
  }

  return children;
}
