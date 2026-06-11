/** DNC PPE → Glove routing helpers (import / backfill scripts). */

const DNC_GLOVE_STYLE_PREFIX_RE = /^G[CGLMNPR]/i;

const DNC_GLOVE_EXTRA_SLUGS = new Set([
  "dnc-p3dg",
  "dnc-pcdb10283",
  "dnc-pcgl41b360",
  "dnc-ppgl41",
]);

export function isDncGloveStyleCode(styleCode) {
  const code = String(styleCode ?? "").trim().toUpperCase();
  return code.length > 0 && DNC_GLOVE_STYLE_PREFIX_RE.test(code);
}

export function isDncPpeGloveProductRow({ slug, name, category, supplier_name }) {
  const meta = { slug, category, supplier_name };
  const sup = String(supplier_name ?? "").trim().toLowerCase();
  if (sup !== "dnc workwear" && sup !== "dnc" && !String(slug ?? "").trim().toLowerCase().startsWith("dnc-")) {
    return false;
  }
  const slugLc = String(slug ?? "").trim().toLowerCase();
  if (DNC_GLOVE_EXTRA_SLUGS.has(slugLc)) {
    return true;
  }
  if (/^dnc-g[cglmnpgr]/i.test(slugLc)) {
    return true;
  }
  const cat = String(category ?? "").trim().toLowerCase();
  if (cat === "glove" || cat === "gloves") {
    return true;
  }
  const fromSlug = /^dnc-([a-z0-9]+)$/i.exec(slugLc);
  if (fromSlug?.[1] && isDncGloveStyleCode(fromSlug[1])) {
    return true;
  }
  const m = String(name ?? "").trim().match(/\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/);
  return m?.[1] ? isDncGloveStyleCode(m[1]) : false;
}
