/** Brand label for category browse Brand filter — mirrors `/categories/[slug]` inference. */
export function inferCategoryBrowseBrandLabel(item: {
  supplier_name?: string | null;
  name: string;
  slug?: string | null;
  description?: string | null;
}): string {
  const hay = `${item.name} ${item.slug ?? ""} ${item.description ?? ""}`.toLowerCase();
  if (hay.includes("syzmik")) {
    return "Syzmik";
  }
  if (hay.includes("bisley")) {
    return "Bisley";
  }
  const direct = String(item.supplier_name ?? "").trim();
  if (direct) {
    const lower = direct.toLowerCase();
    if (lower === "jb's wear" || lower === "jbs wear" || lower === "jbswear" || /\bjbs\s*wear\b/i.test(lower)) {
      return "JB's Wear";
    }
    return direct;
  }
  if (hay.includes("jb-") || hay.includes("jbs")) {
    return "JB's Wear";
  }
  return "";
}
