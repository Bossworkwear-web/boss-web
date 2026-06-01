"use client";

import { useEffect } from "react";

import { clearCartItems } from "@/lib/cart";

/**
 * Empties the cart once when the customer lands on My account right after a successful order
 * (`/customer?placed=<order>`). Belt-and-suspenders with the cart clear on the payment page so the
 * cart never lingers after checkout, regardless of how the order was finalised.
 */
export function ClearCartOnPlaced() {
  useEffect(() => {
    clearCartItems();
  }, []);
  return null;
}
