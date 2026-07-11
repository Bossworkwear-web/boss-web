import { describe, expect, it } from "vitest";

import { xeroInvoiceContactDisplayName } from "@/lib/xero/contacts";

describe("xeroInvoiceContactDisplayName", () => {
  it("prefers company / organisation name", () => {
    expect(
      xeroInvoiceContactDisplayName({
        organisation: "VenueSmart",
        customerName: "Wayne Sun",
        email: "wayne@example.com",
      }),
    ).toBe("VenueSmart");
  });

  it("falls back to customer name then email", () => {
    expect(
      xeroInvoiceContactDisplayName({
        organisation: "  ",
        customerName: "Wayne Sun",
        email: "wayne@example.com",
      }),
    ).toBe("Wayne Sun");
    expect(
      xeroInvoiceContactDisplayName({
        organisation: null,
        customerName: "",
        email: "wayne@example.com",
      }),
    ).toBe("wayne@example.com");
  });
});
