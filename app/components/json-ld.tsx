/**
 * Renders a schema.org JSON-LD <script>. Use with builders from `@/lib/seo/json-ld`.
 * `<` is escaped to avoid breaking out of the script tag.
 */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }}
    />
  );
}
