import type { SupabaseClient } from "@supabase/supabase-js";

export const PROMOTION_CODE_STATUSES = ["active", "disabled", "expired"] as const;
export type PromotionCodeStatus = (typeof PROMOTION_CODE_STATUSES)[number];

export const PROMOTION_DISCOUNT_TYPES = ["percent", "fixed_aud"] as const;
export type PromotionDiscountType = (typeof PROMOTION_DISCOUNT_TYPES)[number];

export type PromotionCodeRow = {
  id: string;
  code: string;
  description: string | null;
  discount_type: PromotionDiscountType;
  discount_value: number;
  min_subtotal_aud: number;
  starts_at: string | null;
  ends_at: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  max_redemptions_per_customer: number | null;
  status: PromotionCodeStatus;
  sent_to_email: string | null;
  sent_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export function normalizePromotionCodeInput(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

export function roundPromotionMoneyAud(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function computePromotionDiscountAud(
  row: Pick<PromotionCodeRow, "discount_type" | "discount_value">,
  productSubtotalAud: number,
): number {
  const subtotal = Math.max(0, productSubtotalAud);
  let discount = 0;
  if (row.discount_type === "percent") {
    const pct = Math.min(100, Math.max(0, Number(row.discount_value)));
    discount = subtotal * (pct / 100);
  } else {
    discount = Math.max(0, Number(row.discount_value));
  }
  return roundPromotionMoneyAud(Math.min(discount, subtotal));
}

export type ValidatePromotionResult =
  | {
      ok: true;
      promotionCodeId: string;
      code: string;
      description: string | null;
      discountAud: number;
      discountType: PromotionDiscountType;
      discountValue: number;
    }
  | { ok: false; error: string };

export async function validatePromotionCodeForCheckout(
  supabase: SupabaseClient,
  args: {
    codeInput: string;
    customerEmail: string;
    productSubtotalAud: number;
    /** When true, skip increment checks that only matter at redemption (still checks validity window). */
    preview?: boolean;
  },
): Promise<ValidatePromotionResult> {
  const normalized = normalizePromotionCodeInput(args.codeInput);
  if (!normalized || normalized.length < 3 || normalized.length > 32) {
    return { ok: false, error: "Enter a valid discount code." };
  }

  const email = args.customerEmail.trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "Sign in to use a discount code." };
  }

  const subtotal = Math.max(0, args.productSubtotalAud);
  const now = Date.now();

  const { data: row, error } = await supabase
    .from("promotion_codes")
    .select(
      "id, code, description, discount_type, discount_value, min_subtotal_aud, starts_at, ends_at, max_redemptions, redemption_count, max_redemptions_per_customer, status",
    )
    .eq("code", normalized)
    .maybeSingle();

  if (error || !row) {
    return { ok: false, error: "This discount code is not valid." };
  }

  const promo = row as PromotionCodeRow;

  if (promo.status === "disabled") {
    return { ok: false, error: "This discount code is no longer active." };
  }
  if (promo.status === "expired") {
    return { ok: false, error: "This discount code has expired." };
  }

  if (promo.starts_at) {
    const startMs = Date.parse(promo.starts_at);
    if (!Number.isNaN(startMs) && now < startMs) {
      return { ok: false, error: "This discount code is not active yet." };
    }
  }
  if (promo.ends_at) {
    const endMs = Date.parse(promo.ends_at);
    if (!Number.isNaN(endMs) && now > endMs) {
      return { ok: false, error: "This discount code has expired." };
    }
  }

  const minSub = Number(promo.min_subtotal_aud) || 0;
  if (subtotal < minSub) {
    return {
      ok: false,
      error: `Minimum product subtotal for this code is $${minSub.toFixed(2)}.`,
    };
  }

  if (promo.max_redemptions != null && promo.redemption_count >= promo.max_redemptions) {
    return { ok: false, error: "This discount code has reached its usage limit." };
  }

  if (promo.max_redemptions_per_customer != null && promo.max_redemptions_per_customer > 0) {
    const { count, error: countErr } = await supabase
      .from("promotion_code_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("promotion_code_id", promo.id)
      .ilike("customer_email", email);

    if (countErr) {
      return { ok: false, error: "Could not validate discount code." };
    }
    if ((count ?? 0) >= promo.max_redemptions_per_customer) {
      return { ok: false, error: "You have already used this discount code." };
    }
  }

  const discountAud = computePromotionDiscountAud(promo, subtotal);
  if (discountAud <= 0) {
    return { ok: false, error: "This discount code does not apply to your order." };
  }

  return {
    ok: true,
    promotionCodeId: promo.id,
    code: promo.code,
    description: promo.description,
    discountAud,
    discountType: promo.discount_type,
    discountValue: Number(promo.discount_value),
  };
}

export async function recordPromotionRedemption(
  supabase: SupabaseClient,
  args: {
    promotionCodeId: string;
    customerEmail: string;
    discountCents: number;
    storeOrderId: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = args.customerEmail.trim().toLowerCase();

  const { error: insErr } = await supabase.from("promotion_code_redemptions").insert({
    promotion_code_id: args.promotionCodeId,
    customer_email: email,
    discount_cents: args.discountCents,
    store_order_id: args.storeOrderId,
  });

  if (insErr) {
    return { ok: false, error: insErr.message || "Could not record promotion use." };
  }

  const { data: promo, error: fetchErr } = await supabase
    .from("promotion_codes")
    .select("redemption_count")
    .eq("id", args.promotionCodeId)
    .maybeSingle();

  if (!fetchErr && promo) {
    const next = (promo.redemption_count ?? 0) + 1;
    await supabase
      .from("promotion_codes")
      .update({ redemption_count: next, updated_at: new Date().toISOString() })
      .eq("id", args.promotionCodeId);
  }

  return { ok: true };
}
