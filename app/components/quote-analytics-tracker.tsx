"use client";

import { useEffect, useRef } from "react";

import { trackQuoteRequest } from "@/lib/analytics";

type QuoteAnalyticsTrackerProps = {
  status?: string;
  bulkEnquiry?: boolean;
};

/** Fires GA4 quote conversion once when `/quote?status=success`. */
export function QuoteAnalyticsTracker({ status, bulkEnquiry = false }: QuoteAnalyticsTrackerProps) {
  const fired = useRef(false);

  useEffect(() => {
    if (status !== "success" || fired.current) return;
    fired.current = true;
    trackQuoteRequest({
      waitForGtag: true,
      lead_type: bulkEnquiry ? "bulk_enquiry" : "bulk_quote",
    });
  }, [status, bulkEnquiry]);

  return null;
}
