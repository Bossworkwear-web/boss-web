"use client";

import { useEffect, useRef } from "react";

import { trackPurchase } from "@/lib/analytics";

type PurchaseAnalyticsTrackerProps = {
  orderNumber: string;
  valueAud?: number;
  itemCount?: number;
};

/** Fires GA4 purchase once when checkout completes. */
export function PurchaseAnalyticsTracker({
  orderNumber,
  valueAud,
  itemCount,
}: PurchaseAnalyticsTrackerProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (!orderNumber || fired.current) return;
    fired.current = true;
    trackPurchase({
      transaction_id: orderNumber,
      ...(valueAud != null && valueAud > 0 ? { value: valueAud } : {}),
      ...(itemCount != null && itemCount > 0 ? { item_count: itemCount } : {}),
    });
  }, [orderNumber, valueAud, itemCount]);

  return null;
}
