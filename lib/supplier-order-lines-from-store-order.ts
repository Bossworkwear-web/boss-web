import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { productPathSegment, slugifyProductNameForPath } from "@/lib/product-path-slug";
import { resolveSupplierNamesByProductKeys } from "@/lib/supplier-line-catalog-supplier";
import { supplierPrefixFromSheetProductId } from "@/lib/supplier-prefix-from-product-id";
import { normalizeSupplierOrderLineSupplierValue } from "@/lib/supplier-order-supplier-normalize";
import type { StoreOrderCartLine } from "@/lib/store-order-cart-payload";

const MAX_STR = 500;
const MAX_NOTES = 4000;
const PRODUCT_UUID_RE = /^[0-9a-f-]{36}$/i;

function clampSupplierStr(s: string, max: number) {
  return s.trim().slice(0, max);
}

type CatalogRow = {
  name: string;
  slug: string | null;
  supplier_name: string | null;
};

/** One query: storefront-style product id + supplier label per `products.id` UUID. */
async function catalogByProductUuid(
  supabase: SupabaseClient<Database>,
  lines: StoreOrderCartLine[],
): Promise<Map<string, CatalogRow>> {
  const ids = [
    ...new Set(
      lines
        .map((l) => (typeof l.productId === "string" ? l.productId.trim() : ""))
        .filter((id) => PRODUCT_UUID_RE.test(id)),
    ),
  ];
  const map = new Map<string, CatalogRow>();
  if (ids.length === 0) return map;

  let rows:
    | { id: string; slug: string | null; name: string; supplier_name?: string | null }[]
    | null = null;
  const rich = await supabase.from("products").select("id, slug, name, supplier_name").in("id", ids);
  if (!rich.error && rich.data) {
    rows = rich.data;
  } else {
    const slim = await supabase.from("products").select("id, slug, name").in("id", ids);
    if (slim.error) {
      console.error("[store checkout] products catalog lookup failed:", slim.error.message);
      return map;
    }
    rows = slim.data;
  }
  for (const row of rows ?? []) {
    map.set(row.id, {
      name: typeof row.name === "string" ? row.name : "",
      slug: typeof row.slug === "string" ? row.slug : null,
      supplier_name:
        "supplier_name" in row && typeof row.supplier_name === "string" ? row.supplier_name : null,
    });
  }
  return map;
}

/** Human-facing product id for supplier sheet (same as URL / admin style code), not `products.id` UUID. */
function resolveSupplierSheetProductId(line: StoreOrderCartLine, catalog: Map<string, CatalogRow>): string {
  const pid = typeof line.productId === "string" ? line.productId.trim() : "";
  if (PRODUCT_UUID_RE.test(pid)) {
    const row = catalog.get(pid);
    if (row && row.name) {
      return productPathSegment({ name: row.name, slug: row.slug });
    }
    return slugifyProductNameForPath(line.productName);
  }
  if (pid.length > 0) {
    return pid;
  }
  return slugifyProductNameForPath(line.productName);
}

function cartLineToSupplierInsert(
  orderNumber: string,
  listDateYmd: string,
  line: StoreOrderCartLine,
  supplier: string,
  productIdForSheet: string,
): Database["public"]["Tables"]["supplier_order_lines"]["Insert"] {
  const name = line.productName.trim();
  const extra = line.notes?.trim();
  let notes = `Web order: ${name}`;
  if (extra) notes = `${notes} · ${extra}`;
  notes = notes.slice(0, MAX_NOTES);

  const qty = Math.max(0, Math.min(1_000_000, Math.floor(line.quantity)));
  let unitCents = Math.round(line.unitPrice * 100);
  if (!Number.isFinite(unitCents) || unitCents < 0) unitCents = 0;
  unitCents = Math.min(unitCents, 999_999_999);

  return {
    list_date: listDateYmd,
    supplier: clampSupplierStr(normalizeSupplierOrderLineSupplierValue(supplier), MAX_STR),
    customer_order_id: clampSupplierStr(orderNumber, MAX_STR),
    product_id: clampSupplierStr(productIdForSheet.toUpperCase(), MAX_STR),
    colour: clampSupplierStr(line.color ?? "", MAX_STR),
    size: clampSupplierStr(line.size ?? "", MAX_STR),
    quantity: qty,
    unit_price_cents: unitCents,
    notes,
  };
}

/**
 * After a paid web checkout, mirror each cart line on today’s Perth supplier daily sheet.
 * Supplier prefix uses the full storefront slug (first segment); **Product ID** stores only the last
 * segment when it matches the 2+ parts + 1–12 alnum tail rule (e.g. `fb-bizcare-cpt451ms` → `CPT451MS`).
 */
export async function insertSupplierOrderLinesFromStoreCheckout(
  supabase: SupabaseClient<Database>,
  orderNumber: string,
  listDateYmd: string,
  lines: StoreOrderCartLine[],
): Promise<void> {
  if (lines.length === 0) return;
  const catalog = await catalogByProductUuid(supabase, lines);

  const uuidList = [
    ...new Set(
      lines
        .map((l) => (typeof l.productId === "string" ? l.productId.trim() : ""))
        .filter((id) => PRODUCT_UUID_RE.test(id)),
    ),
  ];
  /** Dedicated `id → supplier_name` pass: fills gaps when the rich catalog select fell back to slim (no `supplier_name` in row). */
  const supplierByProductKey = await resolveSupplierNamesByProductKeys(supabase, uuidList);

  const tentative = lines.map((l) => {
    const pid = typeof l.productId === "string" ? l.productId.trim() : "";
    const row = PRODUCT_UUID_RE.test(pid) ? catalog.get(pid) : undefined;
    const fromCatalogRow = (row?.supplier_name ?? "").trim();
    const fromKeyed =
      PRODUCT_UUID_RE.test(pid) && supplierByProductKey.has(pid)
        ? (supplierByProductKey.get(pid) ?? "").trim()
        : "";
    const fromCart = (l.supplierName ?? "").trim();
    const supplier = fromCatalogRow || fromKeyed || fromCart;
    const productIdForSheet = resolveSupplierSheetProductId(l, catalog);
    return { line: l, pid, supplier, productIdForSheet };
  });

  const slugKeys = new Set<string>();
  for (const t of tentative) {
    if (t.supplier) continue;
    const sheet = t.productIdForSheet.trim();
    if (sheet.length > 0) slugKeys.add(sheet);
    if (t.pid.length > 0 && !PRODUCT_UUID_RE.test(t.pid)) {
      slugKeys.add(t.pid);
    }
  }
  const supplierBySlug =
    slugKeys.size > 0 ? await resolveSupplierNamesByProductKeys(supabase, [...slugKeys]) : new Map<string, string>();

  const rows = tentative.map(({ line, pid, supplier, productIdForSheet }) => {
    let s = supplier;
    if (!s) {
      const sheet = productIdForSheet.trim();
      const fromSheet = sheet ? (supplierBySlug.get(sheet) ?? "").trim() : "";
      const fromRawPid =
        pid && !PRODUCT_UUID_RE.test(pid) ? (supplierBySlug.get(pid) ?? "").trim() : "";
      s = fromSheet || fromRawPid;
    }
    const prefix = supplierPrefixFromSheetProductId(productIdForSheet);
    const supplierCell = prefix ?? s;
    return cartLineToSupplierInsert(orderNumber, listDateYmd, line, supplierCell, productIdForSheet);
  });
  const { error } = await supabase.from("supplier_order_lines").insert(rows);
  if (error) {
    console.error("[store checkout] supplier_order_lines insert failed:", error.message);
  }
}
