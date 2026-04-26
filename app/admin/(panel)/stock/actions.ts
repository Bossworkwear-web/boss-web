"use server";

import { revalidatePath } from "next/cache";

import { assertAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type UpdateStockResult = { ok: true } | { ok: false; error: string };
export type UpdatePriceResult = { ok: true } | { ok: false; error: string };

export async function updateProductStock(productId: string, stockQuantity: number): Promise<UpdateStockResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  if (!productId || typeof stockQuantity !== "number" || !Number.isFinite(stockQuantity) || stockQuantity < 0) {
    return { ok: false, error: "Invalid stock value" };
  }

  const qty = Math.floor(stockQuantity);

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("products")
      .update({ stock_quantity: qty })
      .eq("id", productId);

    if (error) {
      return {
        ok: false,
        error:
          error.message.includes("stock_quantity") || error.code === "42703"
            ? "Run migration: add column stock_quantity to products (see supabase/migrations)."
            : error.message,
      };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/stock");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}

export async function updateProductBasePrice(productId: string, basePrice: number): Promise<UpdatePriceResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  if (!productId || typeof basePrice !== "number" || !Number.isFinite(basePrice) || basePrice < 0) {
    return { ok: false, error: "Invalid price" };
  }

  const price = Math.round(basePrice * 100) / 100;

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("products")
      .update({ base_price: price })
      .eq("id", productId);

    if (error) {
      return {
        ok: false,
        error:
          error.message.includes("base_price") || error.code === "42703"
            ? "Run migration: add column base_price to products (see supabase/migrations)."
            : error.message,
      };
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/categories");
    revalidatePath("/admin");
    revalidatePath("/admin/stock");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}

export async function updateProductSalePrice(productId: string, salePrice: number | null): Promise<UpdatePriceResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  if (!productId) {
    return { ok: false, error: "Invalid product" };
  }

  const payload =
    salePrice == null
      ? { sale_price: null as number | null }
      : typeof salePrice === "number" && Number.isFinite(salePrice) && salePrice > 0
        ? { sale_price: Math.round(salePrice * 100) / 100 }
        : { sale_price: null as number | null };

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("products").update(payload).eq("id", productId);

    if (error) {
      return {
        ok: false,
        error:
          error.message.includes("sale_price") || error.code === "42703"
            ? "Run migration: add column sale_price to products (see supabase/migrations/20260475_products_sale_price.sql)."
            : error.message,
      };
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/categories");
    revalidatePath("/admin");
    revalidatePath("/admin/stock");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}

export async function applyDefaultPriceToMissing(defaultBasePrice: number): Promise<UpdatePriceResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  if (typeof defaultBasePrice !== "number" || !Number.isFinite(defaultBasePrice) || defaultBasePrice <= 0) {
    return { ok: false, error: "Invalid default price" };
  }

  const price = Math.round(defaultBasePrice * 100) / 100;

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("products")
      .update({ base_price: price })
      .is("base_price", null);

    if (error) {
      return {
        ok: false,
        error:
          error.message.includes("base_price") || error.code === "42703"
            ? "Run migration: add column base_price to products (see supabase/migrations)."
            : error.message,
      };
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/categories");
    revalidatePath("/admin");
    revalidatePath("/admin/stock");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}

export type UpdateVisibilityResult = { ok: true } | { ok: false; error: string };

export async function setProductStorefrontHidden(
  productId: string,
  storefrontHidden: boolean,
): Promise<UpdateVisibilityResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  if (!productId || typeof storefrontHidden !== "boolean") {
    return { ok: false, error: "Invalid request" };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("products")
      .update({
        storefront_hidden: storefrontHidden,
        storefront_hidden_at: storefrontHidden ? new Date().toISOString() : null,
      })
      .eq("id", productId);

    if (error) {
      return {
        ok: false,
        error:
          error.message.includes("storefront_hidden") || error.message.includes("storefront_hidden_at") || error.code === "42703"
            ? "Run migration: add columns storefront_hidden / storefront_hidden_at to products (see supabase/migrations)."
            : error.message,
      };
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/categories");
    revalidatePath("/admin");
    revalidatePath("/admin/stock");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}

export type DeleteProductsResult = { ok: true } | { ok: false; error: string };

export async function deleteProducts(productIds: string[]): Promise<DeleteProductsResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  if (!Array.isArray(productIds) || productIds.length === 0) {
    return { ok: false, error: "No products selected" };
  }

  const uuidRe = /^[0-9a-f-]{36}$/i;
  const ids = [...new Set(productIds.map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => uuidRe.test(s)))];
  if (ids.length === 0) {
    return { ok: false, error: "Invalid product ids" };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("products").delete().in("id", ids);
    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/categories");
    revalidatePath("/admin");
    revalidatePath("/admin/stock");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return { ok: false, error: msg };
  }
}

export type BulkVisibilityResult = { ok: true } | { ok: false; error: string };

export async function setProductsStorefrontHidden(
  productIds: string[],
  storefrontHidden: boolean,
): Promise<BulkVisibilityResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  if (!Array.isArray(productIds) || productIds.length === 0 || typeof storefrontHidden !== "boolean") {
    return { ok: false, error: "Invalid request" };
  }

  const uuidRe = /^[0-9a-f-]{36}$/i;
  const ids = [
    ...new Set(productIds.map((s) => (typeof s === "string" ? s.trim() : "")).filter((s) => uuidRe.test(s))),
  ];
  if (ids.length === 0) {
    return { ok: false, error: "Invalid product ids" };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("products")
      .update({
        storefront_hidden: storefrontHidden,
        storefront_hidden_at: storefrontHidden ? new Date().toISOString() : null,
      })
      .in("id", ids);

    if (error) {
      return {
        ok: false,
        error:
          error.message.includes("storefront_hidden") ||
          error.message.includes("storefront_hidden_at") ||
          error.code === "42703"
            ? "Run migration: add columns storefront_hidden / storefront_hidden_at to products (see supabase/migrations)."
            : error.message,
      };
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/categories");
    revalidatePath("/admin");
    revalidatePath("/admin/stock");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}
