import { describe, expect, it } from "vitest";

import {
  hashCustomerPassword,
  isCustomerPasswordHash,
  verifyCustomerPassword,
} from "@/lib/customer-password-hash";

describe("customer-password-hash", () => {
  it("hashes and verifies a password", () => {
    const hashed = hashCustomerPassword("secret-pass");
    expect(isCustomerPasswordHash(hashed)).toBe(true);
    expect(verifyCustomerPassword("secret-pass", hashed)).toBe(true);
    expect(verifyCustomerPassword("wrong", hashed)).toBe(false);
  });

  it("supports legacy plain-text values during migration", () => {
    expect(isCustomerPasswordHash("plain-old")).toBe(false);
    expect(verifyCustomerPassword("plain-old", "plain-old")).toBe(true);
    expect(verifyCustomerPassword("other", "plain-old")).toBe(false);
  });

  it("rejects empty stored values", () => {
    expect(verifyCustomerPassword("x", null)).toBe(false);
    expect(verifyCustomerPassword("x", "")).toBe(false);
  });
});
