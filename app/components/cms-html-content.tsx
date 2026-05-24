type Props = {
  html: string;
  className?: string;
};

/** Renders admin-authored HTML for legal/CMS pages (trusted admin content only). */
export function CmsHtmlContent({ html, className }: Props) {
  return (
    <div
      className={
        className ??
        "prose prose-sm max-w-none space-y-4 text-sm leading-relaxed text-brand-navy/90 [&_h2]:mb-2 [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-medium [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_strong]:text-brand-navy"
      }
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
