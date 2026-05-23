/** Online checkout vs in-store / internal (admin-created) store orders. */

export type StoreOrderChannel = "online" | "instore";

export type StoreOrderStripeFields = {
  stripe_checkout_session_id?: string | null;
  stripe_payment_intent_id?: string | null;
};

export function isOnlineStoreOrder(row: StoreOrderStripeFields): boolean {
  const cs = (row.stripe_checkout_session_id ?? "").trim();
  const pi = (row.stripe_payment_intent_id ?? "").trim();
  return cs.length > 0 || pi.length > 0;
}

export function isInstoreStoreOrder(row: StoreOrderStripeFields): boolean {
  return !isOnlineStoreOrder(row);
}

export function storeOrdersListBasePath(channel: StoreOrderChannel): string {
  return channel === "online" ? "/admin/online-orders" : "/admin/instore-orders";
}

export function storeOrderDetailBackHref(row: StoreOrderStripeFields): string {
  return storeOrdersListBasePath(isOnlineStoreOrder(row) ? "online" : "instore");
}
