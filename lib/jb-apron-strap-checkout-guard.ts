import { jbStyleCodeFromNameOrSlug } from "@/lib/jb-order-together";

/** Apron bodies that require a separate strap warning at checkout. */
export const JB_APRON_BODIES_REQUIRING_STRAP_CHECKOUT_WARN = ["5ACBB", "5ACBC", "5ACBD"] as const;

/** Compatible changeable straps. */
export const JB_APRON_STRAP_STYLE_CODES_FOR_CHECKOUT = ["5ACBS", "5ACPS"] as const;

export const JB_APRON_STRAPLESS_CHECKOUT_CONFIRM_MESSAGE =
  "Do you want to proceed with payment without straps? You can choose a strap from 5ACBS or 5ACPS.";

export type CartLineStyleMeta = {
  productName?: string | null;
  productPathSlug?: string | null;
};

function styleCodeFromCartLine(line: CartLineStyleMeta): string | null {
  return jbStyleCodeFromNameOrSlug(String(line.productName ?? ""), line.productPathSlug ?? null);
}

/**
 * True when the cart has at least one 5ACBB / 5ACBC / 5ACBD line and no 5ACBS / 5ACPS line.
 */
export function cartNeedsJbApronStrapCheckoutConfirm(
  lines: readonly CartLineStyleMeta[],
): boolean {
  const codes = new Set(
    lines
      .map((line) => styleCodeFromCartLine(line))
      .filter((c): c is string => Boolean(c)),
  );
  const hasApronBody = JB_APRON_BODIES_REQUIRING_STRAP_CHECKOUT_WARN.some((c) => codes.has(c));
  if (!hasApronBody) {
    return false;
  }
  const hasStrap = JB_APRON_STRAP_STYLE_CODES_FOR_CHECKOUT.some((c) => codes.has(c));
  return !hasStrap;
}

/**
 * Show the English confirm when needed. Returns true if checkout may continue.
 * Cancel / dismiss → false.
 */
export function confirmJbApronStraplessCheckoutIfNeeded(
  lines: readonly CartLineStyleMeta[],
): boolean {
  if (!cartNeedsJbApronStrapCheckoutConfirm(lines)) {
    return true;
  }
  if (typeof window === "undefined") {
    return true;
  }
  return window.confirm(JB_APRON_STRAPLESS_CHECKOUT_CONFIRM_MESSAGE);
}
