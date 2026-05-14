/** Payload returned by `/api/orders/track-status` and used on the customer track page. */
export type OrderTrackDeliveryPayload = {
  status: string;
  created_at: string;
  shipped_at: string | null;
  tracking_number: string | null;
  carrier: string;
};

export type DeliveryTimelineDot = "complete" | "current" | "upcoming" | "cancelled";

export type DeliveryTimelineStep = {
  key: "placed" | "processing" | "dispatch" | "expected";
  title: string;
  subtitle: string;
  dot: DeliveryTimelineDot;
};

function normStatus(status: string): string {
  return (status ?? "").trim().toLowerCase();
}

/** Add N business days (Mon–Fri) in local time. */
export function addBusinessDaysLocal(start: Date, businessDays: number): Date {
  const d = new Date(start.getTime());
  let n = 0;
  while (n < businessDays) {
    d.setDate(d.getDate() + 1);
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) {
      n += 1;
    }
  }
  return d;
}

export function formatAuMediumDate(d: Date): string {
  try {
    return d.toLocaleDateString("en-AU", { dateStyle: "medium" });
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function formatAuMediumDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export function buildDeliveryTimeline(payload: OrderTrackDeliveryPayload): DeliveryTimelineStep[] {
  const s = normStatus(payload.status);
  const cancelled = s === "cancelled";
  const created = formatAuMediumDateTime(payload.created_at);

  let placedDot: DeliveryTimelineDot = cancelled ? "cancelled" : "complete";
  let processingDot: DeliveryTimelineDot;
  let dispatchDot: DeliveryTimelineDot;
  let expectedDot: DeliveryTimelineDot;

  let processingSubtitle: string;
  let dispatchSubtitle: string;
  let expectedSubtitle: string;

  if (cancelled) {
    processingDot = dispatchDot = expectedDot = "cancelled";
    processingSubtitle = "This order was cancelled.";
    dispatchSubtitle = "—";
    expectedSubtitle = "—";
  } else if (s === "shipped") {
    processingDot = "complete";
    dispatchDot = "complete";
    expectedDot = "complete";
    processingSubtitle = "Your order has been prepared.";
    if (payload.shipped_at) {
      dispatchSubtitle = `Dispatched ${formatAuMediumDateTime(payload.shipped_at)}`;
    } else if (payload.tracking_number) {
      dispatchSubtitle = `Tracking: ${payload.tracking_number}`;
    } else {
      dispatchSubtitle = "Your parcel is on the way.";
    }
    if (payload.shipped_at) {
      const eta = addBusinessDaysLocal(new Date(payload.shipped_at), 7);
      expectedSubtitle = `Typical metro delivery by around ${formatAuMediumDate(eta)} (Australia Post).`;
    } else {
      expectedSubtitle = "We’ll refine this once dispatch details are finalised.";
    }
  } else if (s === "processing") {
    placedDot = "complete";
    processingDot = "complete";
    dispatchDot = "current";
    expectedDot = "upcoming";
    processingSubtitle = "We’re preparing your items.";
    dispatchSubtitle = "Waiting for carrier handoff.";
    expectedSubtitle = "We’ll show an estimate after dispatch.";
  } else {
    // `paid` and any other non-cancelled status: treat as paid / awaiting production
    placedDot = "complete";
    processingDot = "current";
    dispatchDot = "upcoming";
    expectedDot = "upcoming";
    processingSubtitle = `Received ${created}. We’re getting your order ready.`;
    dispatchSubtitle = "Not yet dispatched.";
    expectedSubtitle = "We’ll show an estimate after dispatch.";
  }

  return [
    {
      key: "placed",
      title: "Order placed",
      subtitle: cancelled ? "—" : `Confirmed ${created}`,
      dot: placedDot,
    },
    {
      key: "processing",
      title: "Processing",
      subtitle: processingSubtitle,
      dot: processingDot,
    },
    {
      key: "dispatch",
      title: "Dispatch",
      subtitle: dispatchSubtitle,
      dot: dispatchDot,
    },
    {
      key: "expected",
      title: "Expected arrival",
      subtitle: expectedSubtitle,
      dot: expectedDot,
    },
  ];
}
