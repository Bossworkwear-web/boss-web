"use client";

import { useEffect, useRef } from "react";

import { trackQuoteRequest } from "@/lib/analytics";

type QuoteAnalyticsTrackerProps = {
  status?: string;
};

/** Fires GA4 quote conversion once when `/quote?status=success`. */
export function QuoteAnalyticsTracker({ status }: QuoteAnalyticsTrackerProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (status !== "success" || fired.current) return;
    fired.current = true;
    trackQuoteRequest();
  }, [status]);

  return null;
}
