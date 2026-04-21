"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

function parseOptionalQuantity(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.floor(n);
}

function parseSortOrder(raw: string): number {
  const n = Number(raw.trim());
  if (!Number.isFinite(n)) return 0;
  return Math.floor(n);
}

function boolFromForm(formData: FormData, key: string): boolean {
  return (formData.get(key) ?? "").toString() === "true";
}

export async function createClearanceStockItem(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const title = (formData.get("title") ?? "").toString().trim();
  if (!title) {
    redirect("/admin/clearance-stock?error=missing_title");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("clearance_stock_items").insert({
    title,
    subtitle: (formData.get("subtitle") ?? "").toString(),
    description: (formData.get("description") ?? "").toString(),
    price_label: (formData.get("price_label") ?? "").toString(),
    quantity: parseOptionalQuantity((formData.get("quantity") ?? "").toString()),
    product_slug: (() => {
      const s = (formData.get("product_slug") ?? "").toString().trim();
      return s.length ? s : null;
    })(),
    image_url: (() => {
      const s = (formData.get("image_url") ?? "").toString().trim();
      return s.length ? s : null;
    })(),
    sort_order: parseSortOrder((formData.get("sort_order") ?? "0").toString()),
    is_published: boolFromForm(formData, "is_published"),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    const short = error.message.length > 400 ? `${error.message.slice(0, 400)}…` : error.message;
    redirect(`/admin/clearance-stock?error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/clearance-stock");
  redirect("/admin/clearance-stock?created=1");
}

export async function updateClearanceStockItem(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const id = (formData.get("id") ?? "").toString().trim();
  const title = (formData.get("title") ?? "").toString().trim();
  if (!id || !title) {
    redirect("/admin/clearance-stock?error=invalid_row");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("clearance_stock_items")
    .update({
      title,
      subtitle: (formData.get("subtitle") ?? "").toString(),
      description: (formData.get("description") ?? "").toString(),
      price_label: (formData.get("price_label") ?? "").toString(),
      quantity: parseOptionalQuantity((formData.get("quantity") ?? "").toString()),
      product_slug: (() => {
        const s = (formData.get("product_slug") ?? "").toString().trim();
        return s.length ? s : null;
      })(),
      image_url: (() => {
        const s = (formData.get("image_url") ?? "").toString().trim();
        return s.length ? s : null;
      })(),
      sort_order: parseSortOrder((formData.get("sort_order") ?? "0").toString()),
      is_published: boolFromForm(formData, "is_published"),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    const short = error.message.length > 400 ? `${error.message.slice(0, 400)}…` : error.message;
    redirect(`/admin/clearance-stock?error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/clearance-stock");
  redirect("/admin/clearance-stock?updated=1");
}

export async function deleteClearanceStockItem(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const id = (formData.get("id") ?? "").toString().trim();
  if (!id) {
    redirect("/admin/clearance-stock?error=invalid_row");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("clearance_stock_items").delete().eq("id", id);

  if (error) {
    const short = error.message.length > 400 ? `${error.message.slice(0, 400)}…` : error.message;
    redirect(`/admin/clearance-stock?error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/clearance-stock");
  redirect("/admin/clearance-stock?deleted=1");
}
