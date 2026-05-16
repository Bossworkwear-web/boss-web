import { deleteStoreOrderById } from "@/lib/admin-delete-store-order";
import { createSupabaseAdminClient } from "@/lib/supabase";

const CUSTOMER_MASTER_LOGO_BUCKET = "click-up-sheet-images";
const QUOTE_STORAGE_BUCKET = () => process.env.SUPABASE_STORAGE_BUCKET ?? "quote-logos";

function storagePathFromPublicUrl(publicUrl: string, bucket: string): string | null {
  const url = publicUrl.trim();
  if (!url) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const i = url.indexOf(marker);
  if (i === -1) return null;
  return decodeURIComponent(url.slice(i + marker.length));
}

async function deleteCustomerMasterLogo(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
): Promise<void> {
  const { data: row } = await supabase
    .from("customer_master_company_logo")
    .select("storage_bucket, storage_path")
    .eq("customer_email", email)
    .maybeSingle();

  const bucket = String((row as { storage_bucket?: string | null })?.storage_bucket ?? "").trim();
  const path = String((row as { storage_path?: string | null })?.storage_path ?? "").trim();
  if (path) {
    await supabase.storage.from(bucket || CUSTOMER_MASTER_LOGO_BUCKET).remove([path]);
  }

  await supabase.from("customer_master_company_logo").delete().eq("customer_email", email);
}

async function deleteQuotesForCustomer(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  email: string,
  profileId: string | null,
): Promise<void> {
  const bucket = QUOTE_STORAGE_BUCKET();
  const quoteIds = new Set<string>();

  if (profileId) {
    const { data: byProfile } = await supabase.from("quote_requests").select("id").eq("customer_profile_id", profileId);
    for (const r of byProfile ?? []) {
      const id = String((r as { id?: string }).id ?? "").trim();
      if (id) quoteIds.add(id);
    }
  }

  const { data: byEmail } = await supabase.from("quote_requests").select("id").ilike("email", email);
  for (const r of byEmail ?? []) {
    const id = String((r as { id?: string }).id ?? "").trim();
    if (id) quoteIds.add(id);
  }

  if (quoteIds.size === 0) return;

  const { data: quotes } = await supabase
    .from("quote_requests")
    .select("id, logo_file_url, quote_mockup_image_urls")
    .in("id", [...quoteIds]);

  const storagePaths: string[] = [];
  for (const q of quotes ?? []) {
    const logoUrl = String((q as { logo_file_url?: string | null }).logo_file_url ?? "").trim();
    const logoPath = logoUrl ? storagePathFromPublicUrl(logoUrl, bucket) : null;
    if (logoPath) storagePaths.push(logoPath);

    for (const mockUrl of (q as { quote_mockup_image_urls?: string[] | null }).quote_mockup_image_urls ?? []) {
      const path = storagePathFromPublicUrl(String(mockUrl ?? "").trim(), bucket);
      if (path) storagePaths.push(path);
    }
  }

  if (storagePaths.length > 0) {
    await supabase.storage.from(bucket).remove(storagePaths);
  }

  await supabase.from("quote_requests").delete().in("id", [...quoteIds]);
}

export type DeleteCustomerResult =
  | { ok: true; deletedOrderCount: number }
  | { ok: false; error: string };

/**
 * Permanently remove a customer (by email) and storefront orders, payments (order totals),
 * promo redemptions, chat, quotes, logos, and profile.
 */
export async function deleteCustomerAndAllRecords(emailRaw: string): Promise<DeleteCustomerResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!email) {
    return { ok: false, error: "Email is required." };
  }

  const supabase = createSupabaseAdminClient();

  const { data: profile } = await supabase
    .from("customer_profiles")
    .select("id")
    .eq("email_address", email)
    .maybeSingle();
  const profileId = profile?.id ? String(profile.id) : null;

  const { data: orders } = await supabase.from("store_orders").select("id").ilike("customer_email", email);

  let deletedOrderCount = 0;
  for (const o of orders ?? []) {
    const orderId = String((o as { id?: string }).id ?? "").trim();
    if (!orderId) continue;
    const res = await deleteStoreOrderById(supabase, orderId);
    if (!res.ok) {
      return { ok: false, error: res.error };
    }
    deletedOrderCount += 1;
  }

  await supabase.from("promotion_code_redemptions").delete().ilike("customer_email", email);

  await supabase.from("storefront_chat_threads").delete().eq("customer_email", email);

  await deleteCustomerMasterLogo(supabase, email);

  await supabase.from("customer_special_requests").delete().eq("customer_email", email);

  await deleteQuotesForCustomer(supabase, email, profileId);

  if (profileId) {
    const { error: profErr } = await supabase.from("customer_profiles").delete().eq("id", profileId);
    if (profErr) {
      return { ok: false, error: profErr.message };
    }
  }

  return { ok: true, deletedOrderCount };
}
