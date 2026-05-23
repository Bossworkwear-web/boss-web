import {
  buildDeliveryTimeline,
  type OrderTrackDeliveryPayload,
} from "@/lib/order-track-delivery";
import { getSiteUrl } from "@/lib/site-url";
import type { SupabaseClient } from "@supabase/supabase-js";

export type StorefrontChatOrderSummary = {
  order_number: string;
  status: string;
  placed_at: string;
  track_url: string;
  delivery_summary: string;
};

export type StorefrontChatCustomerContext = {
  customer_email: string;
  my_account_url: string;
  orders: StorefrontChatOrderSummary[];
};

const ORDER_LIMIT = 3;

function deliverySummaryForOrder(row: {
  status: string;
  created_at: string;
  shipped_at: string | null;
  tracking_number: string | null;
  carrier: string | null;
}): string {
  const payload: OrderTrackDeliveryPayload = {
    status: row.status,
    created_at: row.created_at,
    shipped_at: row.shipped_at,
    tracking_number: row.tracking_number,
    carrier: (row.carrier ?? "").trim() || "Australia Post",
  };
  const steps = buildDeliveryTimeline(payload);
  const expected = steps.find((s) => s.key === "expected");
  const dispatch = steps.find((s) => s.key === "dispatch");
  const parts = [dispatch?.subtitle, expected?.subtitle].filter((s) => s && s !== "—");
  return parts.join(" ") || `Status: ${row.status}`;
}

export async function loadStorefrontChatCustomerContext(
  supabase: SupabaseClient,
  customerEmail: string,
): Promise<StorefrontChatCustomerContext> {
  const site = getSiteUrl();
  const myAccountUrl = `${site}/customer`;

  const ilikeExact = customerEmail.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

  const { data: rows } = await supabase
    .from("store_orders")
    .select("order_number, status, created_at, shipped_at, tracking_number, carrier, tracking_token")
    .ilike("customer_email", ilikeExact)
    .order("created_at", { ascending: false })
    .limit(ORDER_LIMIT);

  const orders: StorefrontChatOrderSummary[] = (rows ?? []).map((r) => {
    const token = String(r.tracking_token ?? "").trim();
    const orderNumber = String(r.order_number ?? "").trim() || "—";
    return {
      order_number: orderNumber,
      status: String(r.status ?? "").trim() || "unknown",
      placed_at: String(r.created_at ?? ""),
      track_url: token ? `${site}/orders/track/${token}` : myAccountUrl,
      delivery_summary: deliverySummaryForOrder({
        status: String(r.status ?? ""),
        created_at: String(r.created_at ?? ""),
        shipped_at: r.shipped_at != null ? String(r.shipped_at) : null,
        tracking_number: r.tracking_number != null ? String(r.tracking_number) : null,
        carrier: r.carrier != null ? String(r.carrier) : null,
      }),
    };
  });

  return {
    customer_email: customerEmail.trim().toLowerCase(),
    my_account_url: myAccountUrl,
    orders,
  };
}

export function formatStorefrontChatOrderContextForPrompt(ctx: StorefrontChatCustomerContext): string {
  if (ctx.orders.length === 0) {
    return "No storefront orders found for this signed-in customer email.";
  }
  return ctx.orders
    .map(
      (o, i) =>
        `${i + 1}. Order ${o.order_number} — status: ${o.status}; placed: ${o.placed_at}; delivery: ${o.delivery_summary}; track: ${o.track_url}`,
    )
    .join("\n");
}
