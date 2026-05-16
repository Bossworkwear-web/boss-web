"use server";

import { randomUUID } from "crypto";
import { refresh, revalidatePath } from "next/cache";

import { assertAdminSession } from "@/lib/admin-auth";
import { publicStorageObjectUrl } from "@/lib/supabase-public-storage-url";
import { createSupabaseAdminClient } from "@/lib/supabase";

const CUSTOMER_MASTER_LOGO_BUCKET = "click-up-sheet-images";

function sanitizeStorageSegment(input: string, maxLen: number): string {
  const s0 = String(input ?? "").trim();
  const s1 = s0
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, maxLen);
  return s1 || "logo";
}

function extFromFileName(name: string): string {
  const m = String(name ?? "").trim().match(/(\.[a-z0-9]{1,8})$/i);
  return m ? m[1].toLowerCase() : ".png";
}

type CustomerSearchHit = {
  email: string;
  name: string | null;
  phone: string | null;
  organisation: string | null;
  profileId: string | null;
};

export type CustomerListRow = CustomerSearchHit & {
  orderCount: number;
  hasProfile: boolean;
};

export async function listAllCustomersForCustomerInfo(): Promise<
  { ok: true; customers: CustomerListRow[] } | { ok: false; error: string }
> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const byEmail = new Map<string, CustomerListRow>();

    const { data: profs, error: profErr } = await supabase
      .from("customer_profiles")
      .select("id, customer_name, organisation, email_address, contact_number, created_at")
      .order("created_at", { ascending: false });
    if (profErr) {
      return { ok: false, error: profErr.message };
    }

    for (const r of profs ?? []) {
      const email = String(r.email_address ?? "").trim().toLowerCase();
      if (!email) continue;
      byEmail.set(email, {
        email,
        name: (r.customer_name ?? "").trim() || null,
        phone: (r.contact_number ?? "").trim() || null,
        organisation: (r.organisation ?? "").trim() || null,
        profileId: String(r.id ?? "").trim() || null,
        orderCount: 0,
        hasProfile: true,
      });
    }

    const { data: orders, error: ordErr } = await supabase
      .from("store_orders")
      .select("customer_email, customer_name")
      .order("created_at", { ascending: false });
    if (ordErr) {
      return { ok: false, error: ordErr.message };
    }

    for (const r of orders ?? []) {
      const email = String(r.customer_email ?? "").trim().toLowerCase();
      if (!email) continue;
      const existing = byEmail.get(email);
      if (existing) {
        existing.orderCount += 1;
        if (!existing.name && (r.customer_name ?? "").trim()) {
          existing.name = String(r.customer_name).trim();
        }
      } else {
        byEmail.set(email, {
          email,
          name: (r.customer_name ?? "").trim() || null,
          phone: null,
          organisation: null,
          profileId: null,
          orderCount: 1,
          hasProfile: false,
        });
      }
    }

    const customers = [...byEmail.values()].sort((a, b) => a.email.localeCompare(b.email));
    return { ok: true, customers };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

export async function searchCustomersForCustomerInfo(
  queryRaw: string,
): Promise<{ ok: true; hits: CustomerSearchHit[] } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const q = queryRaw.trim();
  if (!q) {
    return { ok: true, hits: [] };
  }
  const needle = q.length >= 3 ? `%${q}%` : q;

  try {
    const supabase = createSupabaseAdminClient();
    const hits: CustomerSearchHit[] = [];
    const seen = new Set<string>();

    // 1) Profiles (name/email/phone).
    const { data: profs } = await supabase
      .from("customer_profiles")
      .select("id, customer_name, organisation, email_address, contact_number")
      .or(
        `email_address.ilike.${needle},customer_name.ilike.${needle},organisation.ilike.${needle},contact_number.ilike.${needle}`,
      )
      .limit(30);
    for (const r of profs ?? []) {
      const email = String(r.email_address ?? "").trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      hits.push({
        email,
        name: (r.customer_name ?? "").trim() || null,
        phone: (r.contact_number ?? "").trim() || null,
        organisation: (r.organisation ?? "").trim() || null,
        profileId: String(r.id ?? "").trim() || null,
      });
    }

    // 2) Orders (fallback when no profile exists).
    const { data: orders } = await supabase
      .from("store_orders")
      .select("customer_email, customer_name")
      .ilike("customer_email", needle)
      .order("created_at", { ascending: false })
      .limit(30);
    for (const r of orders ?? []) {
      const email = String(r.customer_email ?? "").trim().toLowerCase();
      if (!email || seen.has(email)) continue;
      seen.add(email);
      hits.push({
        email,
        name: (r.customer_name ?? "").trim() || null,
        phone: null,
        organisation: null,
        profileId: null,
      });
    }

    return { ok: true, hits: hits.slice(0, 40) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Search failed";
    return { ok: false, error: msg };
  }
}

export type CustomerInfoPayload = {
  email: string;
  profile: {
    id: string;
    customer_name: string;
    organisation: string;
    contact_number: string;
    email_address: string;
    delivery_address: string;
    billing_address: string;
    created_at: string;
    /** Plain-text storefront password when set (admin-only surface). */
    login_password: string | null;
  } | null;
  masterLogo: { public_url: string; storage_bucket: string; storage_path: string } | null;
  specialRequest: { body: string; updated_at: string | null } | null;
  orderHistory: Array<{
    id: string;
    order_number: string;
    status: string;
    subtotal_cents: number;
    total_cents: number;
    created_at: string;
  }>;
  mockupHistory: Array<{
    id: string;
    customer_order_id: string;
    list_date: string;
    is_mockup: boolean;
    storage_path: string;
    public_url: string;
    created_at: string;
  }>;
};

export async function getCustomerInfoPayload(
  emailRaw: string,
): Promise<{ ok: true; payload: CustomerInfoPayload } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const email = emailRaw.trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "Email is required." };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: profile } = await supabase
      .from("customer_profiles")
      .select(
        "id, customer_name, organisation, contact_number, email_address, delivery_address, billing_address, created_at, login_password",
      )
      .eq("email_address", email)
      .maybeSingle();

    const { data: master } = await supabase
      .from("customer_master_company_logo")
      .select("storage_bucket, storage_path")
      .eq("customer_email", email)
      .maybeSingle();
    const bucket = String((master as { storage_bucket?: string | null })?.storage_bucket ?? "").trim();
    const path = String((master as { storage_path?: string | null })?.storage_path ?? "").trim();
    const masterLogo =
      bucket && path ? { public_url: publicStorageObjectUrl(bucket, path), storage_bucket: bucket, storage_path: path } : null;

    const { data: sr } = await supabase
      .from("customer_special_requests")
      .select("body, updated_at")
      .eq("customer_email", email)
      .maybeSingle();
    const specialRequest =
      sr && typeof sr === "object"
        ? { body: String((sr as { body?: string | null }).body ?? ""), updated_at: (sr as { updated_at?: string | null }).updated_at ?? null }
        : null;

    const { data: orders } = await supabase
      .from("store_orders")
      .select("id, order_number, status, subtotal_cents, total_cents, created_at")
      .ilike("customer_email", email)
      .order("created_at", { ascending: false })
      .limit(50);
    const orderHistory = (orders ?? []).map((r) => ({
      id: String(r.id),
      order_number: String(r.order_number ?? "").trim(),
      status: String(r.status ?? "").trim(),
      subtotal_cents: typeof r.subtotal_cents === "number" ? r.subtotal_cents : 0,
      total_cents: typeof r.total_cents === "number" ? r.total_cents : 0,
      created_at: String(r.created_at ?? ""),
    }));

    const orderNumbers = orderHistory.map((o) => o.order_number).filter(Boolean).slice(0, 50);
    const { data: mockups } =
      orderNumbers.length > 0
        ? await supabase
            .from("click_up_sheet_images")
            .select("id, customer_order_id, list_date, storage_path, created_at, is_mockup")
            .in("customer_order_id", orderNumbers)
            .order("created_at", { ascending: false })
            .limit(200)
        : { data: [] as any[] };
    const mockupHistory = (mockups ?? []).map((r) => ({
      id: String(r.id),
      customer_order_id: String(r.customer_order_id ?? "").trim(),
      list_date: String(r.list_date ?? "").trim(),
      is_mockup: Boolean((r as { is_mockup?: boolean }).is_mockup),
      storage_path: String(r.storage_path ?? ""),
      public_url: publicStorageObjectUrl("click-up-sheet-images", String(r.storage_path ?? "")),
      created_at: String(r.created_at ?? ""),
    }));

    return {
      ok: true,
      payload: {
        email,
        profile: profile
          ? {
              id: String(profile.id),
              customer_name: String(profile.customer_name ?? ""),
              organisation: String(profile.organisation ?? ""),
              contact_number: String(profile.contact_number ?? ""),
              email_address: String(profile.email_address ?? ""),
              delivery_address: String(profile.delivery_address ?? ""),
              billing_address: String(profile.billing_address ?? ""),
              created_at: String(profile.created_at ?? ""),
              login_password:
                profile.login_password != null && String(profile.login_password).trim()
                  ? String(profile.login_password)
                  : null,
            }
          : null,
        masterLogo,
        specialRequest,
        orderHistory,
        mockupHistory,
      },
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg };
  }
}

export async function upsertCustomerSpecialRequest(args: {
  customerEmail: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const email = args.customerEmail.trim().toLowerCase();
  if (!email) return { ok: false, error: "Email is required." };
  try {
    const supabase = createSupabaseAdminClient();
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("customer_special_requests")
      .upsert(
        { customer_email: email, body: String(args.body ?? ""), updated_at: nowIso },
        { onConflict: "customer_email" },
      );
    if (error) return { ok: false, error: error.message };
    refresh();
    revalidatePath("/admin/customer-info");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return { ok: false, error: msg };
  }
}

export async function deleteCustomerMasterLogo(args: {
  customerEmail: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const email = args.customerEmail.trim().toLowerCase();
  if (!email) return { ok: false, error: "Email is required." };
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("customer_master_company_logo").delete().eq("customer_email", email);
    if (error) return { ok: false, error: error.message };
    refresh();
    revalidatePath("/admin/customer-info");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return { ok: false, error: msg };
  }
}

export async function replaceCustomerMasterLogo(args: {
  customerEmail: string;
  file: File;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const email = args.customerEmail.trim().toLowerCase();
  if (!email) return { ok: false, error: "Email is required." };

  const file = args.file;
  if (!file || typeof file.size !== "number" || file.size <= 0) {
    return { ok: false, error: "Choose a file." };
  }
  if (!String(file.type ?? "").toLowerCase().startsWith("image/")) {
    return { ok: false, error: "Unsupported file type. Please upload an image." };
  }

  try {
    const supabase = createSupabaseAdminClient();

    // Fetch existing pointer so we can best-effort delete old object.
    const { data: existing } = await supabase
      .from("customer_master_company_logo")
      .select("storage_bucket, storage_path")
      .eq("customer_email", email)
      .maybeSingle();
    const oldBucket = String((existing as { storage_bucket?: string | null })?.storage_bucket ?? "").trim();
    const oldPath = String((existing as { storage_path?: string | null })?.storage_path ?? "").trim();

    const baseName = sanitizeStorageSegment(file.name || "logo", 80);
    const ext = extFromFileName(file.name || "");
    const storagePath = `customer-master-logo/${sanitizeStorageSegment(email, 80)}/${randomUUID()}_${baseName}${ext}`;

    const { error: upErr } = await supabase.storage.from(CUSTOMER_MASTER_LOGO_BUCKET).upload(storagePath, file, {
      upsert: false,
      contentType: file.type || undefined,
      cacheControl: "3600",
    });
    if (upErr) return { ok: false, error: upErr.message };

    // Update pointer.
    const nowIso = new Date().toISOString();
    const { error: dbErr } = await supabase
      .from("customer_master_company_logo")
      .upsert(
        {
          customer_email: email,
          storage_bucket: CUSTOMER_MASTER_LOGO_BUCKET,
          storage_path: storagePath,
          updated_at: nowIso,
        },
        { onConflict: "customer_email" },
      );
    if (dbErr) return { ok: false, error: dbErr.message };

    // Best-effort delete old object (only if it looks like our bucket/path).
    if (oldPath) {
      await supabase.storage.from(oldBucket || CUSTOMER_MASTER_LOGO_BUCKET).remove([oldPath]);
    }

    refresh();
    revalidatePath("/admin/customer-info");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload failed";
    return { ok: false, error: msg };
  }
}

export async function deleteCustomerSpecialRequest(args: {
  customerEmail: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const email = args.customerEmail.trim().toLowerCase();
  if (!email) return { ok: false, error: "Email is required." };
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("customer_special_requests").delete().eq("customer_email", email);
    if (error) return { ok: false, error: error.message };
    refresh();
    revalidatePath("/admin/customer-info");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return { ok: false, error: msg };
  }
}

export async function deleteClickUpSheetImageForCustomerInfo(args: {
  imageId: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const id = args.imageId.trim();
  if (!id) return { ok: false, error: "Invalid image id." };
  try {
    const supabase = createSupabaseAdminClient();
    const { data: row, error } = await supabase
      .from("click_up_sheet_images")
      .select("storage_path")
      .eq("id", id)
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!row?.storage_path) return { ok: false, error: "Image not found." };

    const storagePath = String(row.storage_path).trim();
    const { error: delErr } = await supabase.from("click_up_sheet_images").delete().eq("id", id);
    if (delErr) return { ok: false, error: delErr.message };
    await supabase.storage.from("click-up-sheet-images").remove([storagePath]);

    refresh();
    revalidatePath("/admin/customer-info");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return { ok: false, error: msg };
  }
}

export async function updateCustomerProfile(args: {
  profileId: string;
  customer_name: string;
  organisation: string;
  contact_number: string;
  delivery_address: string;
  billing_address: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const id = args.profileId.trim();
  if (!id) return { ok: false, error: "profileId is required." };
  try {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase
      .from("customer_profiles")
      .update({
        customer_name: args.customer_name,
        organisation: args.organisation,
        contact_number: args.contact_number,
        delivery_address: args.delivery_address,
        billing_address: args.billing_address,
      })
      .eq("id", id);
    if (error) return { ok: false, error: error.message };
    refresh();
    revalidatePath("/admin/customer-info");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}

