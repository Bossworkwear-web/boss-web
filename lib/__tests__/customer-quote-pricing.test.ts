import { describe, expect, it } from "vitest";

import { repriceQuoteLines } from "@/lib/customer-quote-pricing";

describe("repriceQuoteLines", () => {
  it("updates product price from live DB even when quote snapshot differs", () => {
    const current = new Map([["p1", 40]]);
    const result = repriceQuoteLines(
      [
        {
          productId: "p1",
          quantity: 2,
          listUnitPrice: 30,
          unitPrice: 30,
          totalPrice: 60,
          productBaseUnit: 30,
        },
      ],
      current,
    );
    expect(result.changed).toBe(true);
    expect(result.lines[0]?.listUnitPrice).toBe(40);
    expect(result.lines[0]?.unitPrice).toBe(40);
    expect(result.lines[0]?.totalPrice).toBe(80);
  });

  it("preserves decoration extras on top of the live product price", () => {
    const current = new Map([["p1", 35]]);
    const result = repriceQuoteLines(
      [
        {
          productId: "p1",
          quantity: 1,
          listUnitPrice: 50,
          unitPrice: 50,
          totalPrice: 50,
          productBaseUnit: 30,
        },
      ],
      current,
    );
    // decoration was 20; live product 35 → 55
    expect(result.lines[0]?.listUnitPrice).toBe(55);
    expect(result.lines[0]?.totalPrice).toBe(55);
  });

  it("uses live product price when productBaseUnit was not snapshotted", () => {
    const current = new Map([["p1", 42]]);
    const result = repriceQuoteLines(
      [
        {
          productId: "p1",
          quantity: 1,
          listUnitPrice: 99,
          unitPrice: 99,
          totalPrice: 99,
        },
      ],
      current,
    );
    expect(result.changed).toBe(true);
    expect(result.lines[0]?.listUnitPrice).toBe(42);
    expect(result.lines[0]?.unitPrice).toBe(42);
    expect(result.lines[0]?.totalPrice).toBe(42);
  });

  it("keeps stored prices when the product has no live catalog price", () => {
    const result = repriceQuoteLines(
      [
        {
          productId: "missing",
          quantity: 1,
          listUnitPrice: 25,
          unitPrice: 25,
          totalPrice: 25,
          productBaseUnit: 25,
        },
      ],
      new Map(),
    );
    expect(result.changed).toBe(false);
    expect(result.lines[0]?.listUnitPrice).toBe(25);
  });
});
