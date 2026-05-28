"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

/** Bulk quotes require at least 50 units total. */
export const QUOTE_MIN_TOTAL_QUANTITY = 50;

type QuoteQuantityContextValue = {
  totalQuantity: number;
  setTotalQuantity: (total: number) => void;
  canSubmit: boolean;
};

const QuoteQuantityContext = createContext<QuoteQuantityContextValue | null>(null);

export function QuoteQuantityProvider({ children }: { children: ReactNode }) {
  const [totalQuantity, setTotalQuantity] = useState(0);
  const value = useMemo(
    () => ({
      totalQuantity,
      setTotalQuantity,
      canSubmit: totalQuantity >= QUOTE_MIN_TOTAL_QUANTITY,
    }),
    [totalQuantity],
  );
  return <QuoteQuantityContext.Provider value={value}>{children}</QuoteQuantityContext.Provider>;
}

export function useQuoteQuantity() {
  const ctx = useContext(QuoteQuantityContext);
  if (!ctx) {
    throw new Error("useQuoteQuantity must be used within QuoteQuantityProvider");
  }
  return ctx;
}
