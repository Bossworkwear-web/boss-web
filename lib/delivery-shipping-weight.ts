/**
 * Parcel **chargeable weight** per line for `calculateDeliveryFee` (distance × weight bands).
 *
 * Infers product type from title + category, then uses **max(dead weight, cubic weight)** per unit —
 * aligned with common Aus Post–style billing (chargeable = greater of actual vs volumetric).
 *
 * Dead + cubic kg come from the packed-size / cubic-weight guideline table (single piece).
 */

/** When no keyword rule matches — basic cotton pants tier (dead + cubic from table). */
export const FALLBACK_SHIPPING_PROFILE = { deadKg: 0.75, cubicKg: 1.26 } as const;

export type ShippingWeightProfile = {
  /** Recommended actual weight (kg), one piece. */
  deadKg: number;
  /** Approx cubic / volumetric equivalent (kg), one piece. */
  cubicKg: number;
};

/** Packed dimensions (cm) — informational; billing uses precomputed cubic kg. */
export type ShippingPackagingHint = {
  lCm: number;
  wCm: number;
  hCm: number;
  packaging: string;
};

const TABLE: Record<
  string,
  ShippingWeightProfile & Partial<ShippingPackagingHint> & { packaging?: string }
> = {
  heavyWorkwearJacket: { deadKg: 1.8, cubicKg: 5.94, lCm: 55, wCm: 45, hCm: 12, packaging: "Large Box" },
  pufferJacket: { deadKg: 1.5, cubicKg: 5.04, lCm: 50, wCm: 42, hCm: 12, packaging: "Large Box" },
  bomberJacket: { deadKg: 1.3, cubicKg: 4.0, lCm: 50, wCm: 40, hCm: 10, packaging: "Large Box" },
  softshellJacket: { deadKg: 1.0, cubicKg: 2.74, lCm: 45, wCm: 38, hCm: 8, packaging: "Medium Box" },
  sprayJacket: { deadKg: 0.6, cubicKg: 1.05, lCm: 35, wCm: 30, hCm: 5, packaging: "Medium Satchel" },
  heavyWorkwearHoodie: { deadKg: 1.5, cubicKg: 3.84, lCm: 48, wCm: 40, hCm: 10, packaging: "Large Box" },
  zipHoodie: { deadKg: 1.1, cubicKg: 3.08, lCm: 45, wCm: 38, hCm: 9, packaging: "Medium Box" },
  pulloverHoodie: { deadKg: 0.95, cubicKg: 2.35, lCm: 42, wCm: 35, hCm: 8, packaging: "Medium Box" },
  fleecySweat: { deadKg: 0.85, cubicKg: 2.24, lCm: 40, wCm: 35, hCm: 8, packaging: "Medium Box" },
  basicSweater: { deadKg: 0.7, cubicKg: 1.7, lCm: 38, wCm: 32, hCm: 7, packaging: "Medium Satchel" },
  hiVisPolo: { deadKg: 0.5, cubicKg: 1.05, lCm: 35, wCm: 30, hCm: 5, packaging: "Small Satchel" },
  heavyCottonPolo: { deadKg: 0.4, cubicKg: 0.72, lCm: 32, wCm: 28, hCm: 4, packaging: "Small Satchel" },
  basicPolo: { deadKg: 0.3, cubicKg: 0.45, lCm: 30, wCm: 25, hCm: 3, packaging: "Small Satchel" },
  hiVisShirt: { deadKg: 0.75, cubicKg: 1.54, lCm: 40, wCm: 32, hCm: 6, packaging: "Medium Satchel" },
  drillShirt: { deadKg: 0.65, cubicKg: 1.14, lCm: 38, wCm: 30, hCm: 5, packaging: "Medium Satchel" },
  businessShirtLS: { deadKg: 0.45, cubicKg: 0.78, lCm: 35, wCm: 28, hCm: 4, packaging: "Small Satchel" },
  businessShirtSS: { deadKg: 0.35, cubicKg: 0.48, lCm: 32, wCm: 25, hCm: 3, packaging: "Small Satchel" },
  hiVisShorts: { deadKg: 0.65, cubicKg: 1.05, lCm: 35, wCm: 30, hCm: 5, packaging: "Medium Satchel" },
  cargoShorts: { deadKg: 0.65, cubicKg: 1.05, lCm: 35, wCm: 30, hCm: 5, packaging: "Medium Satchel" },
  chinoShorts: { deadKg: 0.45, cubicKg: 0.72, lCm: 32, wCm: 28, hCm: 4, packaging: "Small Satchel" },
  basicShorts: { deadKg: 0.4, cubicKg: 0.67, lCm: 30, wCm: 28, hCm: 4, packaging: "Small Satchel" },
  cargoPants: { deadKg: 1.1, cubicKg: 2.24, lCm: 40, wCm: 35, hCm: 8, packaging: "Medium Box" },
  heavyDrillPants: { deadKg: 0.95, cubicKg: 1.7, lCm: 38, wCm: 32, hCm: 7, packaging: "Medium Satchel" },
  chinoPants: { deadKg: 0.6, cubicKg: 0.98, lCm: 35, wCm: 28, hCm: 5, packaging: "Medium Satchel" },
  basicCottonPants: { deadKg: 0.75, cubicKg: 1.26, lCm: 35, wCm: 30, hCm: 6, packaging: "Medium Satchel" },
};

function pick(key: keyof typeof TABLE): ShippingWeightProfile {
  const row = TABLE[key];
  return { deadKg: row.deadKg, cubicKg: row.cubicKg };
}

export function chargeableKgFromProfile(profile: ShippingWeightProfile): number {
  return Math.max(profile.deadKg, profile.cubicKg);
}

function normHaystack(productName: string, category?: string | null): string {
  return `${productName ?? ""}\n${category ?? ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function hiVis(h: string): boolean {
  return /\b(hi[\s-]?vis|hivis)\b/.test(h) || h.includes("hi vis");
}

function hasPants(h: string): boolean {
  return /\b(pants?|trousers?|trouser)\b/.test(h);
}

function hasShorts(h: string): boolean {
  return /\bshorts?\b/.test(h);
}

/**
 * Resolve dead + cubic kg for one SKU from name/category (same cascade as before).
 */
export function resolveShippingWeightProfile(
  productName: string,
  category?: string | null,
): ShippingWeightProfile {
  const h = normHaystack(productName, category);
  if (!h) return { ...FALLBACK_SHIPPING_PROFILE };

  const hi = hiVis(h);

  if (/\bheavy\b/.test(h) && /\bworkwear\b/.test(h) && /\bjacket\b/.test(h)) return pick("heavyWorkwearJacket");
  if (/\bpuffer\b/.test(h) && /\bjacket\b/.test(h)) return pick("pufferJacket");
  if (/\bpuffer\b/.test(h)) return pick("pufferJacket");
  if (/\bbomber\b/.test(h) && /\bjacket\b/.test(h)) return pick("bomberJacket");
  if (/\bsoftshell\b/.test(h)) return pick("softshellJacket");
  if (/\bspray\b/.test(h) && /\bjacket\b/.test(h)) return pick("sprayJacket");

  if (/\bheavy\b/.test(h) && /\bworkwear\b/.test(h) && /\bhoodie\b/.test(h)) return pick("heavyWorkwearHoodie");
  if (/\bzip\b/.test(h) && /\bhoodie\b/.test(h)) return pick("zipHoodie");
  if (/\bhoodie\b/.test(h)) return pick("pulloverHoodie");
  if (/\bfleece|fleecy\b/.test(h)) return pick("fleecySweat");
  if (/\bsweater\b/.test(h)) return pick("basicSweater");

  if (hi && /\bpolo\b/.test(h)) return pick("hiVisPolo");
  if (/\bheavy\b/.test(h) && /\bcotton\b/.test(h) && /\bpolo\b/.test(h)) return pick("heavyCottonPolo");
  if (/\bpolo\b/.test(h)) return pick("basicPolo");

  if (h.includes("singlet")) return pick("basicPolo");
  if (/\btee\b/.test(h) || /t[\s-]?shirt/.test(h)) return pick("businessShirtSS");

  if (hi && /\bshirt\b/.test(h)) return pick("hiVisShirt");
  if (/\bdrill\b/.test(h) && /\bshirt\b/.test(h)) return pick("drillShirt");
  if (/\b(business|dress)\b/.test(h) && /\bshirt\b/.test(h)) {
    if (/\b(long[\s-]?sleeve|l\/s)\b/.test(h) || h.includes("long sleeve")) return pick("businessShirtLS");
    return pick("businessShirtSS");
  }
  if (/\bshirt\b/.test(h)) {
    if (/\b(long[\s-]?sleeve|l\/s)\b/.test(h) || h.includes("long sleeve")) return pick("businessShirtLS");
    if (/\b(short[\s-]?sleeve|s\/s)\b/.test(h) || h.includes("short sleeve")) return pick("businessShirtSS");
    return pick("businessShirtSS");
  }

  if (hi && hasShorts(h)) return pick("hiVisShorts");
  if (/\bcargo\b/.test(h) && hasShorts(h)) return pick("cargoShorts");
  if (/\bchino\b/.test(h) && hasShorts(h)) return pick("chinoShorts");
  if (hasShorts(h)) return pick("basicShorts");

  if (/\bcargo\b/.test(h) && hasPants(h)) return pick("cargoPants");
  if (/\bheavy\b/.test(h) && /\bdrill\b/.test(h) && hasPants(h)) return pick("heavyDrillPants");
  if (/\bdrill\b/.test(h) && hasPants(h)) return pick("heavyDrillPants");
  if (/\bchino\b/.test(h) && hasPants(h)) return pick("chinoPants");
  if (hasPants(h)) return pick("basicCottonPants");

  if (hi && /\bvest\b/.test(h)) return pick("hiVisPolo");

  if (/\bjacket\b/.test(h) || /\bcoat\b/.test(h)) return pick("softshellJacket");

  return { ...FALLBACK_SHIPPING_PROFILE };
}

/**
 * **Chargeable kg** for one unit (max of dead vs cubic). Used for delivery fee bands.
 */
export function shippingKgPerLineUnit(productName: string, category?: string | null): number {
  return chargeableKgFromProfile(resolveShippingWeightProfile(productName, category));
}

export function totalEstimatedShippingWeightKg(
  lines: ReadonlyArray<{ productName: string; quantity: number; category?: string | null }>,
): number {
  const w = lines.reduce((sum, line) => {
    const q = Number.isFinite(line.quantity) ? Math.max(0, Math.floor(line.quantity)) : 0;
    return sum + q * shippingKgPerLineUnit(line.productName, line.category);
  }, 0);
  return Number(w.toFixed(2));
}

/** @deprecated use FALLBACK_SHIPPING_PROFILE + chargeableKg — kept for any external imports */
export const FALLBACK_SHIPPING_KG_PER_UNIT = Math.max(
  FALLBACK_SHIPPING_PROFILE.deadKg,
  FALLBACK_SHIPPING_PROFILE.cubicKg,
);
