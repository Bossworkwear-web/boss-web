import { describe, expect, it } from "vitest";

import { withTaxInvoiceOneOffBalancingLines } from "@/lib/store-tax-invoice";

describe("withTaxInvoiceOneOffBalancingLines", () => {
  it("adds a Credit line for BOS_20260901_001 residual so GST can reconcile", () => {
    const lines = [
      {
        product_name: "Hoodie",
        quantity: 2,
        unit_price_cents: 5660,
        line_total_cents: 56599,
        service_type: "Embroidery",
        color: null,
        size: null,
      },
    ];
    const next = withTaxInvoiceOneOffBalancingLines(
      { order_number: "BOS_20260901_001", total_cents: 63199, delivery_fee_cents: 0 },
      lines,
    );
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({
      product_name: "Credit",
      quantity: 1,
      unit_price_cents: 6600,
      line_total_cents: 6600,
    });
  });

  it("does not alter other orders", () => {
    const lines = [
      {
        product_name: "Hoodie",
        quantity: 1,
        unit_price_cents: 1000,
        line_total_cents: 1000,
        service_type: null,
        color: null,
        size: null,
      },
    ];
    const next = withTaxInvoiceOneOffBalancingLines(
      { order_number: "BOS_20260814_001", total_cents: 2000, delivery_fee_cents: 0 },
      lines,
    );
    expect(next).toEqual(lines);
  });
});
