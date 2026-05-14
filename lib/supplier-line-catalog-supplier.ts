import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { supplierPrefixFromSheetProductId } from "@/lib/supplier-prefix-from-product-id";
import { normalizeSupplierOrderLineSupplierValue } from "@/lib/supplier-order-supplier-normalize";

type SupplierLineRow = Database["public"]["Tables"]["supplier_order_lines"]["Row"];

const PRODUCT_UUID_RE = /^[0-9a-f-]{36}$/i;

/**
 * Map `supplier_order_lines.product_id` (UUID or `products.slug`) → trimmed `products.supplier_name`.
 */
export async function resolveSupplierNamesByProductKeys(
  supabase: SupabaseClient<Database>,
  keys: string[],
): Promise<Map<string, string>> {
  const trimmed = [...new Set(keys.map((k) => k.trim()).filter((k) => k.length > 0))];
  const map = new Map<string, string>();
  if (trimmed.length === 0) return map;

  const uuids = trimmed.filter((k) => PRODUCT_UUID_RE.test(k));
  const slugs = trimmed.filter((k) => !PRODUCT_UUID_RE.test(k));

  if (uuids.length > 0) {
    const { data } = await supabase.from("products").select("id, supplier_name").in("id", uuids);
    for (const r of data ?? []) {
      const sn = r.supplier_name?.trim() ?? "";
      if (sn) map.set(r.id, sn);
    }
  }

  if (slugs.length > 0) {
    const { data } = await supabase.from("products").select("slug, supplier_name").in("slug", slugs);
    for (const r of data ?? []) {
      const sl = r.slug?.trim() ?? "";
      const sn = r.supplier_name?.trim() ?? "";
      if (!sl || !sn) continue;
      for (const k of slugs) {
        if (k === sl || k.toLowerCase() === sl.toLowerCase()) {
          map.set(k, sn);
        }
      }
    }

    const missing = slugs.filter((s) => !map.has(s));
    if (missing.length > 0 && missing.length <= 40) {
      for (const s of missing) {
        const escaped = s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
        const { data: one } = await supabase
          .from("products")
          .select("slug, supplier_name")
          .ilike("slug", escaped)
          .limit(1)
          .maybeSingle();
        const sl = one?.slug?.trim() ?? "";
        const sn = one?.supplier_name?.trim() ?? "";
        if (sl && sn) {
          map.set(s, sn);
        }
      }
    }
  }

  return map;
}

function firstCatalogImageUrl(imageUrls: string[] | null | undefined): string | null {
  const u = imageUrls?.[0];
  return typeof u === "string" && u.trim().length > 0 ? u.trim() : null;
}

/**
 * Map `supplier_order_lines.product_id` (UUID or `products.slug`) → first catalog image URL, or null.
 */
export async function resolveProductImageUrlsByProductKeys(
  supabase: SupabaseClient<Database>,
  keys: string[],
): Promise<Map<string, string | null>> {
  const trimmed = [...new Set(keys.map((k) => k.trim()).filter((k) => k.length > 0))];
  const out = new Map<string, string | null>();
  for (const k of trimmed) {
    out.set(k, null);
  }
  if (trimmed.length === 0) return out;

  const uuids = trimmed.filter((k) => PRODUCT_UUID_RE.test(k));
  const slugs = trimmed.filter((k) => !PRODUCT_UUID_RE.test(k));

  if (uuids.length > 0) {
    const { data } = await supabase.from("products").select("id, image_urls").in("id", uuids);
    for (const r of data ?? []) {
      out.set(r.id, firstCatalogImageUrl(r.image_urls));
    }
  }

  if (slugs.length > 0) {
    const { data } = await supabase.from("products").select("slug, image_urls").in("slug", slugs);
    for (const r of data ?? []) {
      const sl = r.slug?.trim() ?? "";
      if (!sl) continue;
      const url = firstCatalogImageUrl(r.image_urls);
      for (const k of slugs) {
        if (k === sl || k.toLowerCase() === sl.toLowerCase()) {
          out.set(k, url);
        }
      }
    }

    const missing = slugs.filter((s) => !out.get(s));
    if (missing.length > 0 && missing.length <= 40) {
      for (const s of missing) {
        if (out.get(s)) continue;
        const escaped = s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
        const { data: one } = await supabase
          .from("products")
          .select("slug, image_urls")
          .ilike("slug", escaped)
          .limit(1)
          .maybeSingle();
        const url = firstCatalogImageUrl(one?.image_urls);
        if (url) out.set(s, url);
      }
    }
  }

  return out;
}

/** Persist `products.supplier_name` into `supplier_order_lines.supplier` when supplier is blank but product_id resolves. */
export async function backfillEmptySupplierFromCatalog(
  supabase: SupabaseClient<Database>,
  lines: SupplierLineRow[],
): Promise<SupplierLineRow[]> {
  const needs = lines.filter((l) => !(l.supplier ?? "").trim() && (l.product_id ?? "").trim());
  if (needs.length === 0) return lines;

  const keys = needs.map((l) => l.product_id.trim());
  const resolved = await resolveSupplierNamesByProductKeys(supabase, keys);

  let out = lines;
  const updatedAt = new Date().toISOString();

  for (const line of needs) {
    const key = line.product_id.trim();
    const prefix = supplierPrefixFromSheetProductId(key);
    const raw = prefix ?? resolved.get(key);
    if (!raw) continue;
    const label = normalizeSupplierOrderLineSupplierValue(raw).slice(0, 500);

    const { error } = await supabase
      .from("supplier_order_lines")
      .update({ supplier: label, updated_at: updatedAt })
      .eq("id", line.id);

    if (!error) {
      out = out.map((l) => (l.id === line.id ? { ...l, supplier: label, updated_at: updatedAt } : l));
    }
  }

  return out;
}
