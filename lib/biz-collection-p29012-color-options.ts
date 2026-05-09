/**
 * Biz Collection Mens Fusion Polo P29012: storefront colour chip cleanup.
 * - Remove erroneous duplicate label `Black/Fluoro Yellow Lime` (filename-derived).
 * - Normalize `Product Black/Fluoro Yellow/Lime` and CSV `Black/Fluoro Yellow/Lime` → `Black/Fluoro Yellow Lime`.
 */

function compactColorKey(label: string): string {
  return label.trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function isBizCollectionP29012Listing(product: {
  slug?: string | null;
  name?: string | null;
  supplierName?: string | null;
}): boolean {
  const slug = (product.slug ?? "").trim().toLowerCase();
  const name = (product.name ?? "").trim().toLowerCase();
  const sup = (product.supplierName ?? "").trim().toLowerCase();
  const biz =
    sup.includes("biz collection") || slug.includes("bizcollection") || name.includes("biz collection");
  const p290 = slug.includes("p29012") || /\bp29012\b/i.test(product.name ?? "");
  return biz && p290;
}

export function applyBizCollectionP29012ColorDisplayRules(colors: readonly string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  for (const raw of colors) {
    if (typeof raw !== "string") continue;
    const t = raw.trim();
    if (!t) continue;

    const lc = t.toLowerCase();
    /** Erroneous duplicate chip (no slash before final Lime) — drop. */
    if (lc === "black/fluoro yellow lime") {
      continue;
    }

    let label = t;
    const normalizedSpaces = label.replace(/\s+/g, " ").trim();
    if (/^product\s+black\/fluoro yellow\/lime$/i.test(normalizedSpaces)) {
      label = "Black/Fluoro Yellow Lime";
    } else if (/^black\/fluoro yellow\/lime$/i.test(normalizedSpaces)) {
      label = "Black/Fluoro Yellow Lime";
    } else if (compactColorKey(label) === "productblackfluoroyellowlime") {
      label = "Black/Fluoro Yellow Lime";
    }

    const k = compactColorKey(label);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(label);
  }

  return out;
}
