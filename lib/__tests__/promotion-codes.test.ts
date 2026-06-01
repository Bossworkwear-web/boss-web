import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  computePromotionDiscountAud,
  normalizePromotionCodeInput,
  recordPromotionRedemption,
  roundPromotionMoneyAud,
  validatePromotionCodeForCheckout,
  type PromotionCodeRow,
} from "@/lib/promotion-codes";

const basePromo: PromotionCodeRow = {
  id: "promo-1",
  code: "SAVE10",
  description: "10% off",
  discount_type: "percent",
  discount_value: 10,
  min_subtotal_aud: 0,
  starts_at: null,
  ends_at: null,
  max_redemptions: null,
  redemption_count: 0,
  max_redemptions_per_customer: null,
  status: "active",
  sent_to_email: null,
  sent_at: null,
  created_by: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function mockSupabaseForValidate(options: {
  promo?: PromotionCodeRow | null;
  promoError?: boolean;
  customerRedemptionCount?: number;
  redemptionCountError?: boolean;
}) {
  const {
    promo = basePromo,
    promoError = false,
    customerRedemptionCount = 0,
    redemptionCountError = false,
  } = options;

  const redemptionSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      ilike: vi.fn().mockResolvedValue(
        redemptionCountError
          ? { count: null, error: { message: "db error" } }
          : { count: customerRedemptionCount, error: null },
      ),
    }),
  });

  const promoSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue(
        promoError
          ? { data: null, error: { message: "db error" } }
          : { data: promo, error: null },
      ),
    }),
  });

  const from = vi.fn((table: string) => {
    if (table === "promotion_codes") {
      return { select: promoSelect };
    }
    if (table === "promotion_code_redemptions") {
      return { select: redemptionSelect };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from, promoSelect, redemptionSelect } as unknown as SupabaseClient & {
    from: ReturnType<typeof vi.fn>;
  };
}

function mockSupabaseForRecord(options: {
  insertError?: boolean;
  redemptionCount?: number;
  fetchError?: boolean;
}) {
  const { insertError = false, redemptionCount = 2, fetchError = false } = options;

  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn().mockReturnValue({ eq: updateEq });

  const promoFetchSelect = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue(
        fetchError
          ? { data: null, error: { message: "fetch failed" } }
          : { data: { redemption_count: redemptionCount }, error: null },
      ),
    }),
  });

  const insert = vi.fn().mockResolvedValue(
    insertError ? { error: { message: "insert failed" } } : { error: null },
  );

  const from = vi.fn((table: string) => {
    if (table === "promotion_code_redemptions") {
      return { insert };
    }
    if (table === "promotion_codes") {
      return { select: promoFetchSelect, update };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from } as unknown as SupabaseClient,
    insert,
    update,
    updateEq,
  };
}

describe("promotion-codes", () => {
  describe("normalizePromotionCodeInput", () => {
    it("trims, uppercases, and removes internal spaces", () => {
      expect(normalizePromotionCodeInput("  save 10  ")).toBe("SAVE10");
    });
  });

  describe("roundPromotionMoneyAud", () => {
    it("rounds to two decimal places", () => {
      expect(roundPromotionMoneyAud(12.345)).toBe(12.35);
      expect(roundPromotionMoneyAud(12.344)).toBe(12.34);
    });
  });

  describe("computePromotionDiscountAud", () => {
    it("applies percent discounts capped at subtotal", () => {
      expect(
        computePromotionDiscountAud(
          { discount_type: "percent", discount_value: 10 },
          200,
        ),
      ).toBe(20);
      expect(
        computePromotionDiscountAud(
          { discount_type: "percent", discount_value: 150 },
          100,
        ),
      ).toBe(100);
    });

    it("applies fixed AUD discounts capped at subtotal", () => {
      expect(
        computePromotionDiscountAud(
          { discount_type: "fixed_aud", discount_value: 25 },
          100,
        ),
      ).toBe(25);
      expect(
        computePromotionDiscountAud(
          { discount_type: "fixed_aud", discount_value: 150 },
          100,
        ),
      ).toBe(100);
    });

    it("never returns a negative discount", () => {
      expect(
        computePromotionDiscountAud(
          { discount_type: "fixed_aud", discount_value: -5 },
          100,
        ),
      ).toBe(0);
    });

    it("lets a fixed code offset the logo setup fee when a higher cap is given", () => {
      // Cart: $8.30 product subtotal + $66 logo setup fee. A $66 FREESETUP code should
      // discount the full $66 (cap = subtotal + setup fee), not just the $8.30 subtotal.
      expect(
        computePromotionDiscountAud(
          { discount_type: "fixed_aud", discount_value: 66 },
          8.3,
          8.3 + 66,
        ),
      ).toBe(66);
      // Without the higher cap it stays capped at the product subtotal (legacy behaviour).
      expect(
        computePromotionDiscountAud(
          { discount_type: "fixed_aud", discount_value: 66 },
          8.3,
        ),
      ).toBe(8.3);
    });
  });

  describe("validatePromotionCodeForCheckout", () => {
    it("rejects codes that are too short after normalization", async () => {
      const supabase = mockSupabaseForValidate({});
      const result = await validatePromotionCodeForCheckout(supabase, {
        codeInput: "ab",
        customerEmail: "buyer@example.com",
        productSubtotalAud: 100,
      });
      expect(result).toEqual({ ok: false, error: "Enter a valid discount code." });
    });

    it("requires a signed-in customer email", async () => {
      const supabase = mockSupabaseForValidate({});
      const result = await validatePromotionCodeForCheckout(supabase, {
        codeInput: "SAVE10",
        customerEmail: "   ",
        productSubtotalAud: 100,
      });
      expect(result).toEqual({ ok: false, error: "Sign in to use a discount code." });
    });

    it("returns a percent discount for a valid active code", async () => {
      const supabase = mockSupabaseForValidate({});
      const result = await validatePromotionCodeForCheckout(supabase, {
        codeInput: " save10 ",
        customerEmail: "Buyer@Example.com",
        productSubtotalAud: 200,
      });
      expect(result).toEqual({
        ok: true,
        promotionCodeId: "promo-1",
        code: "SAVE10",
        description: "10% off",
        discountAud: 20,
        discountType: "percent",
        discountValue: 10,
      });
    });

    it("rejects disabled and expired statuses", async () => {
      const supabaseDisabled = mockSupabaseForValidate({
        promo: { ...basePromo, status: "disabled" },
      });
      expect(
        await validatePromotionCodeForCheckout(supabaseDisabled, {
          codeInput: "SAVE10",
          customerEmail: "buyer@example.com",
          productSubtotalAud: 100,
        }),
      ).toEqual({ ok: false, error: "This discount code is no longer active." });

      const supabaseExpired = mockSupabaseForValidate({
        promo: { ...basePromo, status: "expired" },
      });
      expect(
        await validatePromotionCodeForCheckout(supabaseExpired, {
          codeInput: "SAVE10",
          customerEmail: "buyer@example.com",
          productSubtotalAud: 100,
        }),
      ).toEqual({ ok: false, error: "This discount code has expired." });
    });

    it("enforces minimum subtotal", async () => {
      const supabase = mockSupabaseForValidate({
        promo: { ...basePromo, min_subtotal_aud: 150 },
      });
      const result = await validatePromotionCodeForCheckout(supabase, {
        codeInput: "SAVE10",
        customerEmail: "buyer@example.com",
        productSubtotalAud: 100,
      });
      expect(result).toEqual({
        ok: false,
        error: "Minimum product subtotal for this code is $150.00.",
      });
    });

    it("rejects codes that reached global redemption limit", async () => {
      const supabase = mockSupabaseForValidate({
        promo: { ...basePromo, max_redemptions: 5, redemption_count: 5 },
      });
      const result = await validatePromotionCodeForCheckout(supabase, {
        codeInput: "SAVE10",
        customerEmail: "buyer@example.com",
        productSubtotalAud: 100,
      });
      expect(result).toEqual({
        ok: false,
        error: "This discount code has reached its usage limit.",
      });
    });

    it("rejects customers who exceeded per-customer redemption limit", async () => {
      const supabase = mockSupabaseForValidate({
        promo: { ...basePromo, max_redemptions_per_customer: 1 },
        customerRedemptionCount: 1,
      });
      const result = await validatePromotionCodeForCheckout(supabase, {
        codeInput: "SAVE10",
        customerEmail: "buyer@example.com",
        productSubtotalAud: 100,
      });
      expect(result).toEqual({
        ok: false,
        error: "You have already used this discount code.",
      });
    });
  });

  describe("recordPromotionRedemption", () => {
    it("inserts redemption and increments promotion redemption_count", async () => {
      const { client, insert, update, updateEq } = mockSupabaseForRecord({
        redemptionCount: 4,
      });

      const result = await recordPromotionRedemption(client, {
        promotionCodeId: "promo-1",
        customerEmail: " Buyer@Example.com ",
        discountCents: 2000,
        storeOrderId: "order-1",
      });

      expect(result).toEqual({ ok: true });
      expect(insert).toHaveBeenCalledWith({
        promotion_code_id: "promo-1",
        customer_email: "buyer@example.com",
        discount_cents: 2000,
        store_order_id: "order-1",
      });
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({ redemption_count: 5 }),
      );
      expect(updateEq).toHaveBeenCalledWith("id", "promo-1");
    });

    it("returns an error when insert fails", async () => {
      const { client } = mockSupabaseForRecord({ insertError: true });
      const result = await recordPromotionRedemption(client, {
        promotionCodeId: "promo-1",
        customerEmail: "buyer@example.com",
        discountCents: 2000,
        storeOrderId: "order-1",
      });
      expect(result).toEqual({ ok: false, error: "insert failed" });
    });
  });
});
