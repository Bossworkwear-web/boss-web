import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

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

/** Resolve display name + organisation (CRM profile) from `store_orders.order_number`. */
export async function getCustomerDetailForStoreOrderNumber(
  supabase: SupabaseClient<Database>,
  orderNumber: string,
): Promise<{
  customerName: string;
  organisationName: string;
  logoLocations: string;
  checkoutMemos: StoreOrderCustomerMemoLine[];
}> {
  const id = orderNumber.trim();
  if (!id) {
    return { customerName: "", organisationName: "", logoLocations: "", checkoutMemos: [] };
  }

  const { data: so, error } = await supabase
    .from("store_orders")
    .select("id, customer_name, customer_email")
    .eq("order_number", id)
    .maybeSingle();

  if (error || !so) {
    return { customerName: "", organisationName: "", logoLocations: "", checkoutMemos: [] };
  }

  const customerName = (so.customer_name ?? "").trim();
  const emailRaw = (so.customer_email ?? "").trim();
  let organisationName = "";

  if (emailRaw) {
    const emailLower = emailRaw.toLowerCase();
    const { data: profEq } = await supabase
      .from("customer_profiles")
      .select("organisation")
      .eq("email_address", emailLower)
      .maybeSingle();

    if (profEq?.organisation != null && profEq.organisation.trim()) {
      organisationName = profEq.organisation.trim();
    } else {
      const { data: profEqOrig } = await supabase
        .from("customer_profiles")
        .select("organisation")
        .eq("email_address", emailRaw)
        .maybeSingle();

      if (profEqOrig?.organisation != null && profEqOrig.organisation.trim()) {
        organisationName = profEqOrig.organisation.trim();
      } else {
        const { data: profIlike } = await supabase
          .from("customer_profiles")
          .select("organisation")
          .ilike("email_address", emailRaw)
          .maybeSingle();

        if (profIlike?.organisation != null && profIlike.organisation.trim()) {
          organisationName = profIlike.organisation.trim();
        }
      }
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

  return { customerName, organisationName, logoLocations, checkoutMemos };
}
