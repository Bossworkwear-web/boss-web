import { describe, expect, it } from "vitest";

import {
  composeCustomerAddress,
  formatCustomerAddressForDisplay,
  parseCustomerAddress,
} from "@/lib/customer-address";

describe("customer-address", () => {
  it("composes with state before postcode", () => {
    expect(
      composeCustomerAddress({
        address1: "12 Main St",
        address2: "",
        suburb: "Morley",
        postcode: "6062",
        state: "WA",
        country: "Australia",
      }),
    ).toBe("12 Main St, Morley, WA, 6062, Australia");
  });

  it("parses legacy suburb, postcode, state order", () => {
    expect(parseCustomerAddress("12 Main St, Morley, 6062, WA, Australia")).toEqual({
      address1: "12 Main St",
      address2: "",
      suburb: "Morley",
      postcode: "6062",
      state: "WA",
      country: "Australia",
    });
  });

  it("parses current suburb, state, postcode order", () => {
    expect(parseCustomerAddress("12 Main St, Morley, WA, 6062, Australia")).toEqual({
      address1: "12 Main St",
      address2: "",
      suburb: "Morley",
      postcode: "6062",
      state: "WA",
      country: "Australia",
    });
  });

  it("formats display with postcode after state", () => {
    expect(formatCustomerAddressForDisplay("Salisbury South, Salisbury South 5106, South Australia, 오스트레일리아")).toBe(
      "Salisbury South, Salisbury South, South Australia, 5106, 오스트레일리아",
    );
  });
});
