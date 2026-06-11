/** DNC PPE → Safty Glasses routing helpers (import / backfill scripts). */

const DNC_SAFETY_SPEC_SLUG_RE = /^dnc-(?:sp|p130|p300|p670|p900|p920)/i;

export function isDncSafetySpecStyleCode(styleCode) {
  const code = String(styleCode ?? "").trim().toUpperCase();
  if (!code) {
    return false;
  }
  if (/^SP\d+/.test(code)) {
    return true;
  }
  if (/^P130/.test(code) || /^P300/.test(code) || /^P670/.test(code) || /^P900/.test(code) || /^P920/.test(code)) {
    return true;
  }
  return false;
}

function dncListingLooksLikeSafetySpec(productName) {
  const n = String(productName ?? "").toLowerCase();
  return (
    /\bsafety\s*spec\b/.test(n) ||
    /\bvisitor\s*spec\b/.test(n) ||
    /\bvistors\s*spec\b/.test(n) ||
    /\bspectacle\b/.test(n) ||
    /\bspec\s+clear\b/.test(n) ||
    /\bspec\s+smoke\b/.test(n)
  );
}

function dncStyleCodeFromRow(name, slug) {
  const slugLc = String(slug ?? "").trim().toLowerCase();
  const fromSlug = /^dnc-([a-z0-9]+)$/i.exec(slugLc);
  if (fromSlug?.[1]) {
    return fromSlug[1].toUpperCase();
  }
  const m = String(name ?? "").trim().match(/\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/);
  return m?.[1] ? m[1].toUpperCase() : null;
}

export function isDncPpeSafetyGlassesProductRow({ slug, name, category, supplier_name }) {
  const sup = String(supplier_name ?? "").trim().toLowerCase();
  if (sup !== "dnc workwear" && sup !== "dnc" && !String(slug ?? "").trim().toLowerCase().startsWith("dnc-")) {
    return false;
  }
  const slugLc = String(slug ?? "").trim().toLowerCase();
  if (DNC_SAFETY_SPEC_SLUG_RE.test(slugLc)) {
    return true;
  }
  const code = dncStyleCodeFromRow(name, slug);
  if (isDncSafetySpecStyleCode(code)) {
    return true;
  }
  return dncListingLooksLikeSafetySpec(name);
}
