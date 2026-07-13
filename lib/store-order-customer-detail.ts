import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import {
  resolveStoreOrderPickUpByIds,
  storeOrderFulfillmentLabel,
  type StoreOrderFulfillmentMethod,
} from "@/lib/store-order-fulfillment";

/** Normalizes `store_order_items.placements` (jsonb array of strings). */
export function placementsFromDb(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((x): x is string => typeof x === "string");
}

/** Per-line placements from checkout (`store_order_items.placements`) for Logo & artwork. */
function formatLogoLocationsSummary(
  items: Array<{
    product_name: string;
    quantity: number;
    color: string | null;
    size: string | null;
    placements: unknown;
  }>,
): string {
  const blocks: string[] = [];
  for (const row of items) {
    const placements = placementsFromDb(row.placements)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!placements.length) continue;

    const name = (row.product_name ?? "").trim() || "Item";
    const color = (row.color ?? "").trim();
    const size = (row.size ?? "").trim();
    const qty = Math.max(0, row.quantity ?? 0);
    const variantParts = [color || null, size || null, qty > 0 ? `×${qty}` : null].filter(Boolean);
    const variant = variantParts.length ? ` — ${variantParts.join(" / ")}` : "";
    blocks.push(`${name}${variant}\n${placements.join("; ")}`);
  }
  return blocks.join("\n\n");
}

/**
 * Removes Supabase Storage public object URLs merged into checkout notes (logo / reference uploads).
 * Keeps the customer-written part; collapses extra blank lines left behind.
 */
export function stripUploadedAssetUrlsFromCheckoutNotes(text: string): string {
  const re = /https?:\/\/[^\s/]+\/storage\/v1\/object\/public\/[^\s<>"')]+/gi;
  return text
    .replace(re, "")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .trim();
}

/** One entry per distinct customer memo (`store_order_items.notes` trimmed). */
export type StoreOrderCustomerMemoLine = {
  notes: string;
};

type CustomerProfileContactFields = {
  organisation: string | null;
  contact_number: string | null;
};

async function lookupCustomerProfileByEmail(
  supabase: SupabaseClient<Database>,
  emailRaw: string,
): Promise<CustomerProfileContactFields | null> {
  const emailLower = emailRaw.toLowerCase();
  const selectCols = "organisation, contact_number";

  const { data: profEq } = await supabase
    .from("customer_profiles")
    .select(selectCols)
    .eq("email_address", emailLower)
    .maybeSingle();
  if (profEq) {
    return profEq;
  }

  const { data: profEqOrig } = await supabase
    .from("customer_profiles")
    .select(selectCols)
    .eq("email_address", emailRaw)
    .maybeSingle();
  if (profEqOrig) {
    return profEqOrig;
  }

  const { data: profIlike } = await supabase
    .from("customer_profiles")
    .select(selectCols)
    .ilike("email_address", emailRaw)
    .maybeSingle();
  return profIlike ?? null;
}

/** Resolve display name, email, phone + organisation (CRM profile) from `store_orders.order_number`. */
export async function getCustomerDetailForStoreOrderNumber(
  supabase: SupabaseClient<Database>,
  orderNumber: string,
): Promise<{
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  organisationName: string;
  logoLocations: string;
  checkoutMemos: StoreOrderCustomerMemoLine[];
  /** `store_orders.id` when the order number matches; used for order barcode (scan code). */
  storeOrderId: string | null;
  /** Pickup vs delivery (from store order / checkout pending). */
  fulfillmentMethod: StoreOrderFulfillmentMethod;
  /** Ship-to address from `store_orders.delivery_address`. */
  deliveryAddress: string;
  /** Delivery fee the customer paid at checkout (`store_orders.delivery_fee_cents`). */
  deliveryFeeCents: number;
}> {
  const empty = {
    customerName: "",
    customerEmail: "",
    customerPhone: "",
    organisationName: "",
    logoLocations: "",
    checkoutMemos: [] as StoreOrderCustomerMemoLine[],
    storeOrderId: null as string | null,
    fulfillmentMethod: "Delivery" as StoreOrderFulfillmentMethod,
    deliveryAddress: "",
    deliveryFeeCents: 0,
  };

  const id = orderNumber.trim();
  if (!id) {
    return empty;
  }

  const { data: so, error } = await supabase
    .from("store_orders")
    .select("id, customer_name, customer_email, delivery_address, delivery_fee_cents")
    .eq("order_number", id)
    .maybeSingle();

  if (error || !so) {
    return empty;
  }

  const customerName = (so.customer_name ?? "").trim();
  const customerEmail = (so.customer_email ?? "").trim();
  const deliveryAddress = (so.delivery_address ?? "").trim();
  const deliveryFeeCents = Math.max(0, Math.round(Number(so.delivery_fee_cents) || 0));
  let organisationName = "";
  let customerPhone = "";

  if (customerEmail) {
    const profile = await lookupCustomerProfileByEmail(supabase, customerEmail);
    if (profile?.organisation?.trim()) {
      organisationName = profile.organisation.trim();
    }
    if (profile?.contact_number?.trim()) {
      customerPhone = profile.contact_number.trim();
    }
  }

  let logoLocations = "";
  const checkoutMemos: StoreOrderCustomerMemoLine[] = [];
  const { data: orderItems, error: itemsError } = await supabase
    .from("store_order_items")
    .select("product_name, quantity, color, size, placements, sort_order, notes")
    .eq("order_id", so.id)
    .order("sort_order", { ascending: true });

  if (!itemsError && orderItems?.length) {
    logoLocations = formatLogoLocationsSummary(orderItems);
    const seenMemoText = new Set<string>();
    for (const row of orderItems) {
      const memo = stripUploadedAssetUrlsFromCheckoutNotes((row.notes ?? "").trim());
      if (!memo || seenMemoText.has(memo)) {
        continue;
      }
      seenMemoText.add(memo);
      checkoutMemos.push({ notes: memo });
    }
  }

  const pickUpById = await resolveStoreOrderPickUpByIds(supabase, [so.id]);
  const fulfillmentMethod = storeOrderFulfillmentLabel(pickUpById.get(so.id) === true);

  return {
    customerName,
    customerEmail,
    customerPhone,
    organisationName,
    logoLocations,
    checkoutMemos,
    storeOrderId: so.id,
    fulfillmentMethod,
    deliveryAddress,
    deliveryFeeCents,
  };
}
