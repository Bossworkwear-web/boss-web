"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { StoreOrderCartLine } from "@/lib/store-order-cart-payload";
import { productPathSegment } from "@/lib/product-path-slug";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";
import { createSupabaseAdminClient } from "@/lib/supabase";

const CLICK_UP_SHEET_IMAGES_BUCKET = "click-up-sheet-images";

function placementsFromDb(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter((x): x is string => typeof x === "string");
}

export type GetOrderLinesForReorderResult =
  | { ok: true; lines: StoreOrderCartLine[]; mockupImageUrls: string[] }
  | { ok: false; error: string };

export async function getOrderLinesForReorder(orderId: string): Promise<GetOrderLinesForReorderResult> {
  const cookieStore = await cookies();
  const sessionEmail = (cookieStore.get("customer_email")?.value ?? "").trim();
  if (!sessionEmail) {
    return { ok: false, error: "Please sign in." };
  }

  const id = orderId.trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return { ok: false, error: "Invalid order." };
  }

  const ilikeExact = sessionEmail.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");

  try {
    const supabase = createSupabaseAdminClient();

    const { data: orderRow, error: orderErr } = await supabase
      .from("store_orders")
      .select("id, order_number")
      .eq("id", id)
      .ilike("customer_email", ilikeExact)
      .maybeSingle();

    if (orderErr || !orderRow) {
      return { ok: false, error: "Order not found or access denied." };
    }

    let mockupImageUrls: string[] = [];
    try {
      const orderNumber = typeof orderRow.order_number === "string" ? orderRow.order_number.trim() : "";
      if (orderNumber.length > 0) {
        const { data: mockRows, error: mockErr } = await supabase
          .from("click_up_sheet_images")
          .select("storage_path")
          .eq("customer_order_id", orderNumber)
          .eq("is_mockup", true)
          .order("list_date", { ascending: false })
          .order("sort_order", { ascending: true })
          .order("created_at", { ascending: true });
        if (!mockErr && mockRows?.length) {
          const seen = new Set<string>();
          for (const r of mockRows) {
            const path = typeof r.storage_path === "string" ? r.storage_path.trim() : "";
            if (!path) {
              continue;
            }
            const url = publicStorageObjectUrl(CLICK_UP_SHEET_IMAGES_BUCKET, path);
            if (url && !seen.has(url)) {
              seen.add(url);
              mockupImageUrls.push(url);
            }
          }
        }
      }
    } catch {
      mockupImageUrls = [];
    }

    const { data: items, error: itemsErr } = await supabase
      .from("store_order_items")
      .select(
        "product_id, product_name, quantity, unit_price_cents, line_total_cents, service_type, color, size, placements, notes, sort_order",
      )
      .eq("order_id", id)
      .order("sort_order", { ascending: true });

    if (itemsErr || !items?.length) {
      return { ok: false, error: "Could not load items for this order." };
    }

    const uuidRe = /^[0-9a-f-]{36}$/i;
    const productIds = [
      ...new Set(
        items
          .map((row) => (typeof row.product_id === "string" ? row.product_id.trim() : ""))
          .filter((pid) => uuidRe.test(pid)),
      ),
    ];

    const imageUrlByProductId = new Map<string, string>();
    const pathSlugByProductId = new Map<string, string>();
    const supplierNameByProductId = new Map<string, string>();
    if (productIds.length > 0) {
      const { data: productRows } = await supabase
        .from("products")
        .select("id, name, slug, image_urls, supplier_name")
        .in("id", productIds);
      for (const p of productRows ?? []) {
        const urls = p.image_urls;
        const first =
          Array.isArray(urls) && urls.length > 0 && typeof urls[0] === "string" ? urls[0].trim() : "";
        if (first.length > 0) {
          imageUrlByProductId.set(p.id, first);
        }
        const name = typeof p.name === "string" ? p.name : "";
        pathSlugByProductId.set(
          p.id,
          productPathSegment({ name, slug: typeof p.slug === "string" ? p.slug : null }),
        );
        const sn = typeof p.supplier_name === "string" ? p.supplier_name.trim() : "";
        if (sn) supplierNameByProductId.set(p.id, sn);
      }
    }

    const lines: StoreOrderCartLine[] = items.map((row) => {
      const pid = typeof row.product_id === "string" ? row.product_id.trim() : "";
      return {
        productId: pid,
        ...(uuidRe.test(pid) && supplierNameByProductId.has(pid)
          ? { supplierName: supplierNameByProductId.get(pid)! }
          : {}),
        productName: row.product_name,
        serviceType: row.service_type ?? "",
        color: row.color ?? "",
        size: row.size ?? "",
        quantity: row.quantity,
        placements: placementsFromDb(row.placements),
        unitPrice: row.unit_price_cents / 100,
        totalPrice: row.line_total_cents / 100,
        notes: row.notes?.trim() ? row.notes.trim() : undefined,
        imageUrl: uuidRe.test(pid) ? imageUrlByProductId.get(pid) : undefined,
        productPathSlug: uuidRe.test(pid) ? pathSlugByProductId.get(pid) : undefined,
      };
    });

    return { ok: true, lines, mockupImageUrls };
  } catch {
    return { ok: false, error: "Something went wrong." };
  }
}

function isNextRedirectError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof (error as { digest?: unknown }).digest === "string" &&
    (error as { digest: string }).digest.includes("NEXT_REDIRECT")
  );
}

export async function submitChangePassword(formData: FormData) {
  const cookieStore = await cookies();
  const sessionEmail = (cookieStore.get("customer_email")?.value ?? "").trim();
  if (!sessionEmail) {
    redirect("/log-in");
  }
  const emailNorm = sessionEmail.toLowerCase();

  const current = String(formData.get("current_password") ?? "").trim();
  const next = String(formData.get("new_password") ?? "").trim();
  const confirm = String(formData.get("confirm_password") ?? "").trim();

  if (!current || !next || !confirm) {
    redirect("/customer?password=invalid");
  }
  if (next !== confirm) {
    redirect("/customer?password=mismatch");
  }
  if (next.length < 8) {
    redirect("/customer?password=weak");
  }
  if (next === current) {
    redirect("/customer?password=same");
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("customer_profiles")
      .select("id, login_password")
      .eq("email_address", emailNorm)
      .maybeSingle();

    if (error || !data) {
      redirect("/customer?password=error");
    }

    const stored = data.login_password;
    if (stored === null || stored === "") {
      redirect("/customer?password=oauth");
    }
    if (stored !== current) {
      redirect("/customer?password=wrong");
    }

    const { error: updateError } = await supabase
      .from("customer_profiles")
      .update({ login_password: next })
      .eq("id", data.id);

    if (updateError) {
      redirect("/customer?password=error");
    }
  } catch (error) {
    if (isNextRedirectError(error)) {
      throw error;
    }
    redirect("/customer?password=error");
  }

  redirect("/customer?password=success");
}
