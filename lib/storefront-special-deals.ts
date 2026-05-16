import { createSupabaseAdminClient } from "@/lib/supabase";

export type StorefrontSpecialDeal = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  priceLabel: string;
  quantity: number | null;
  productSlug: string | null;
  imageUrl: string | null;
};

export async function listPublishedSpecialDeals(): Promise<{
  items: StorefrontSpecialDeal[];
  loadError: string | null;
}> {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("clearance_stock_items")
      .select("id, title, subtitle, description, price_label, quantity, product_slug, image_url")
      .eq("is_published", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      return { items: [], loadError: error.message };
    }

    const items: StorefrontSpecialDeal[] = (data ?? []).map((row) => ({
      id: String(row.id),
      title: String(row.title ?? "").trim(),
      subtitle: String(row.subtitle ?? "").trim(),
      description: String(row.description ?? "").trim(),
      priceLabel: String(row.price_label ?? "").trim(),
      quantity: row.quantity == null ? null : Number(row.quantity),
      productSlug: (row.product_slug ?? "").trim() || null,
      imageUrl: (row.image_url ?? "").trim() || null,
    }));

    return { items, loadError: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to load special deals.";
    return { items: [], loadError: msg };
  }
}
