import {
  C81_FIVE_PACK_DEAL,
  getStorefrontSpecialDealPackageById,
} from "@/lib/storefront-special-deal-packages";

export type CartLineForDealValidation = {
  specialDealPackageId?: string;
  quantity: number;
  totalPrice: number;
  unitPrice: number;
  serviceType: string;
  placements?: string[];
  referenceImageUrls?: string[];
};

function roundAud(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function logoUrlCount(lines: CartLineForDealValidation[]): number {
  const urls = new Set<string>();
  for (const line of lines) {
    for (const u of line.referenceImageUrls ?? []) {
      const t = typeof u === "string" ? u.trim() : "";
      if (t) urls.add(t);
    }
  }
  return urls.size;
}

function placementCount(lines: CartLineForDealValidation[]): number {
  const labels = new Set<string>();
  for (const line of lines) {
    for (const p of line.placements ?? []) {
      const t = typeof p === "string" ? p.trim() : "";
      if (t) labels.add(t);
    }
  }
  return labels.size;
}

/** Server + client guard for fixed package pricing in cart / checkout. */
export function validateSpecialDealPackageCartLines(
  items: readonly CartLineForDealValidation[],
): { ok: true } | { ok: false; error: string } {
  const byDeal = new Map<string, CartLineForDealValidation[]>();
  for (const it of items) {
    const id = (it.specialDealPackageId ?? "").trim();
    if (!id) continue;
    const list = byDeal.get(id) ?? [];
    list.push(it);
    byDeal.set(id, list);
  }

  for (const [dealId, lines] of byDeal) {
    const pkg = getStorefrontSpecialDealPackageById(dealId);
    if (!pkg) {
      return { ok: false, error: "This special deal is no longer available." };
    }

    const qty = lines.reduce((s, l) => s + Math.max(0, Math.floor(Number(l.quantity) || 0)), 0);
    if (qty !== pkg.units) {
      return {
        ok: false,
        error: `The ${pkg.title} offer requires exactly ${pkg.units} shirts in your cart (you have ${qty}).`,
      };
    }

    const lineTotal = roundAud(lines.reduce((s, l) => s + Math.max(0, Number(l.totalPrice) || 0), 0));
    if (lineTotal !== pkg.totalAud) {
      return {
        ok: false,
        error: `The ${pkg.title} offer must total ${pkg.priceLabel} before checkout.`,
      };
    }

    const decorated = lines.some((l) => {
      const st = (l.serviceType ?? "").toLowerCase();
      return st.includes("embroidery") || st.includes("printing");
    });
    if (!decorated) {
      return { ok: false, error: "Choose logo print or embroidery for this special deal." };
    }

    if (placementCount(lines) > pkg.maxPlacements) {
      return {
        ok: false,
        error: `This deal includes ${pkg.maxPlacements} logo placement only.`,
      };
    }

    if (logoUrlCount(lines) > pkg.maxLogos) {
      return {
        ok: false,
        error: `This deal includes ${pkg.maxLogos} logo file only.`,
      };
    }

    for (const line of lines) {
      const st = (line.serviceType ?? "").toLowerCase();
      if (st.includes("plain") && !st.includes("embroidery") && !st.includes("printing")) {
        return { ok: false, error: `Plain shirts are not part of the ${pkg.title} deal.` };
      }
    }
  }

  return { ok: true };
}

export function cartHasSpecialDealPackage(items: readonly { specialDealPackageId?: string }[]): boolean {
  return items.some((it) => Boolean((it.specialDealPackageId ?? "").trim()));
}

export function specialDealPackageNote(pkg = C81_FIVE_PACK_DEAL): string {
  return `[Special deal: ${pkg.styleCode} ${pkg.units}-pack — $${pkg.totalAud} total, ${pkg.maxLogos} logo]`;
}
