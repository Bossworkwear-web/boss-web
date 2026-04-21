"use server";

import { revalidatePath } from "next/cache";

import { assertAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type UpdateStockResult = { ok: true } | { ok: false; error: string };

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
