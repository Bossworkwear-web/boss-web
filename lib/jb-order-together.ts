/**
 * JB's Wear PDP “Order Together” companions (e.g. apron body → separate straps).
 * Keys are style codes from slug (`jb-5acbc`) or trailing `(CODE)` in the product name.
 */

export type JbOrderTogetherCompanion = {
  styleCode: string;
};

export type JbOrderTogetherSpec = {
  companions: readonly JbOrderTogetherCompanion[];
  /** Short note under the Order Together heading. */
  note: string;
};

/** Cross-back apron straps sold separately from WITHOUT STRAP apron bodies. */
export const JB_CROSS_BACK_APRON_STRAP_STYLE_CODES = ["5ACBS", "5ACPS"] as const;

const APRON_STRAP_NOTE =
  "This apron is sold without straps. Order a Changeable Cross Back Apron Strap together (5ACBS or 5ACPS).";

/** Cross-back apron bodies that ship without straps. */
const CROSS_BACK_APRON_WITHOUT_STRAP = ["5ACB", "5ACBB", "5ACBC", "5ACBD", "5ACBE"] as const;

const STRAP_COMPANIONS: readonly JbOrderTogetherCompanion[] = JB_CROSS_BACK_APRON_STRAP_STYLE_CODES.map(
  (styleCode) => ({ styleCode }),
);

const JB_ORDER_TOGETHER_BY_STYLE = new Map<string, JbOrderTogetherSpec>(
  CROSS_BACK_APRON_WITHOUT_STRAP.map((code) => [
    code,
    {
      companions: STRAP_COMPANIONS,
      note: APRON_STRAP_NOTE,
    },
  ]),
);

export function jbStyleCodeFromNameOrSlug(name: string, slug?: string | null): string | null {
  const slugLc = String(slug ?? "")
    .trim()
    .toLowerCase();
  const jbSeg = /(?:^|-)(jb-[a-z0-9][a-z0-9_-]*)$/i.exec(slugLc)?.[1] ?? (/^jb-[a-z0-9]/i.test(slugLc) ? slugLc : null);
  if (jbSeg?.startsWith("jb-")) {
    const parts = jbSeg.slice(3).split("-").filter(Boolean);
    const tail = parts[parts.length - 1] ?? "";
    if (/^[a-z0-9]{3,20}$/i.test(tail)) {
      return tail.toUpperCase().replace(/-CLEARANCE$/i, "");
    }
  }
  const m = String(name)
    .trim()
    .match(/\s*\(([A-Za-z0-9][A-Za-z0-9/_-]*)\)\s*$/);
  return m ? m[1].toUpperCase().replace(/-CLEARANCE$/i, "") : null;
}

export function jbOrderTogetherSpecForProduct(meta: {
  name?: string | null;
  slug?: string | null;
  displayProductCode?: string | null;
}): JbOrderTogetherSpec | null {
  const display = String(meta.displayProductCode ?? "")
    .trim()
    .toUpperCase()
    .replace(/-CLEARANCE$/i, "");
  if (display && JB_ORDER_TOGETHER_BY_STYLE.has(display)) {
    return JB_ORDER_TOGETHER_BY_STYLE.get(display) ?? null;
  }
  const code = jbStyleCodeFromNameOrSlug(String(meta.name ?? ""), meta.slug);
  if (!code) return null;
  return JB_ORDER_TOGETHER_BY_STYLE.get(code) ?? null;
}

/** Preferred storefront slug for a JB style code. */
export function jbStorefrontSlugForStyleCode(styleCode: string): string {
  return `jb-${String(styleCode).trim().toLowerCase()}`;
}
