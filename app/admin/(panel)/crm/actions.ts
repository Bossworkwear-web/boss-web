"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";

import { assertAdminSession } from "@/lib/admin-auth";
import {
  buildQuoteCustomerEmailBody,
  computeTotalCentsFromProductLines,
  DEFAULT_QUOTE_EMAIL_LEAD_TIME,
} from "@/lib/crm/quote-email-draft";
import { isPipelineStage } from "@/lib/crm/pipeline";
import { sendCustomerQuoteSentEmail } from "@/lib/crm/notifications";
import { storefrontRetailFromSupplierBase } from "@/lib/product-price";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { formatMoneyFromCents, siteBaseUrl } from "@/lib/store-order-utils";

import { loadCrmQuoteRowById } from "./load-crm-quote-row";
import { normalizeQuoteEmailProductsForSave, type QuoteEmailProductLine } from "./quote-email-products";

export type ActionResult = { ok: true } | { ok: false; error: string };

const QUOTE_PRODUCT_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type LookupQuoteProductCatalogResult =
  | {
      ok: true;
      name: string;
      colour: string;
      size: string;
      price: string;
    }
  | { ok: false };

type ProductCatalogRow = {
  name: string;
  base_price: number | null;
  available_colors: string[] | null;
  available_sizes: string[] | null;
};

function mapProductRowToCatalogHints(row: ProductCatalogRow): LookupQuoteProductCatalogResult {
  const name = row.name?.trim() ?? "";
  if (!name) return { ok: false };

  const colours = (row.available_colors ?? []).map((c) => String(c).trim()).filter(Boolean);
  const sizes = (row.available_sizes ?? []).map((s) => String(s).trim()).filter(Boolean);

  const retail = storefrontRetailFromSupplierBase(row.base_price);
  const price =
    retail != null ? `${formatMoneyFromCents(Math.round(retail * 100), "AUD")} (catalog GST incl.)` : "";

  return {
    ok: true,
    name,
    colour: colours.join(", "),
    size: sizes.join(", "),
    price,
  };
}

/** Resolve catalog name, colours, sizes, and GST-inclusive list price from UUID or exact storefront slug. */
export async function lookupQuoteProductByIdentifier(raw: string): Promise<LookupQuoteProductCatalogResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false };
  }
  const q = raw.trim();
  if (!q) return { ok: false };

  const supabase = createSupabaseAdminClient();
  const select = "name, base_price, available_colors, available_sizes";

  if (QUOTE_PRODUCT_UUID_RE.test(q)) {
    const { data } = await supabase.from("products").select(select).eq("id", q).maybeSingle();
    if (!data?.name?.trim()) return { ok: false };
    return mapProductRowToCatalogHints(data as ProductCatalogRow);
  }

  const { data: slugRow } = await supabase.from("products").select(select).eq("slug", q).maybeSingle();
  if (!slugRow?.name?.trim()) return { ok: false };
  return mapProductRowToCatalogHints(slugRow as ProductCatalogRow);
}

export async function updateQuotePipelineStage(quoteId: string, stage: string): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!quoteId || !isPipelineStage(stage)) {
    return { ok: false, error: "Invalid stage" };
  }

  const supabase = createSupabaseAdminClient();
  const { data: prev } = await supabase
    .from("quote_requests")
    .select("pipeline_stage, quote_portal_token")
    .eq("id", quoteId)
    .maybeSingle();

  const patch: { pipeline_stage: string; quote_portal_token?: string } = { pipeline_stage: stage };
  if (stage === "quote" && !(prev?.quote_portal_token ?? "").trim()) {
    patch.quote_portal_token = randomBytes(24).toString("hex");
  }

  const { error } = await supabase.from("quote_requests").update(patch).eq("id", quoteId);
  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase.from("crm_activities").insert({
    quote_request_id: quoteId,
    kind: "stage_change",
    body: `Stage: ${prev?.pipeline_stage ?? "?"} → ${stage}`,
  });

  revalidatePath("/admin/crm");
  revalidatePath("/admin");
  revalidatePath(`/admin/crm/send-quote/${quoteId}`);
  return { ok: true };
}

/** Ensures a customer portal token exists when the deal is in Quote sent (e.g. moved via CRM before migrations). */
export async function ensureQuotePortalToken(quoteId: string): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!quoteId) {
    return { ok: false, error: "Invalid id" };
  }

  const supabase = createSupabaseAdminClient();
  const { data: row, error: selErr } = await supabase
    .from("quote_requests")
    .select("pipeline_stage, quote_portal_token")
    .eq("id", quoteId)
    .maybeSingle();
  if (selErr || !row) {
    return { ok: false, error: selErr?.message ?? "Quote not found" };
  }
  if (row.pipeline_stage !== "quote") {
    return { ok: true };
  }
  if ((row.quote_portal_token ?? "").trim()) {
    return { ok: true };
  }

  const token = randomBytes(24).toString("hex");
  const { error } = await supabase.from("quote_requests").update({ quote_portal_token: token }).eq("id", quoteId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/send-quote/${quoteId}`);
  return { ok: true };
}

/**
 * Sends the quote draft email to the customer via Resend, then moves the deal to Quote sent only after send succeeds.
 */
export async function sendQuoteEmailToCustomerAndMarkQuoteSent(quoteId: string): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const id = quoteId?.trim();
  if (!id) {
    return { ok: false, error: "Invalid id" };
  }

  const supabase = createSupabaseAdminClient();
  const { data: stageRow, error: stageErr } = await supabase
    .from("quote_requests")
    .select("pipeline_stage")
    .eq("id", id)
    .maybeSingle();
  if (stageErr || !stageRow) {
    return { ok: false, error: stageErr?.message ?? "Quote not found" };
  }
  if (stageRow.pipeline_stage !== "enquiry") {
    return { ok: false, error: "This lead must be in Enquiry to send the quote email." };
  }

  const quote = await loadCrmQuoteRowById(id);
  if (!quote) {
    return { ok: false, error: "Quote not found" };
  }

  const emailTo = quote.email?.trim();
  if (!emailTo) {
    return { ok: false, error: "Customer email is missing on this quote." };
  }

  const computedTotal = computeTotalCentsFromProductLines(quote.quote_email_products);
  const savedCents = quote.quote_email_total_cents;
  const totalLineOverride =
    savedCents !== null && Number.isFinite(savedCents) && Number.isInteger(savedCents)
      ? `${formatMoneyFromCents(savedCents, "AUD")} (GST included)`
      : null;

  const plainBody = buildQuoteCustomerEmailBody({
    contactName: quote.contact_name,
    companyName: quote.company_name,
    products: quote.quote_email_products,
    totalCents: computedTotal,
    leadTime: quote.quote_email_lead_time?.trim() || DEFAULT_QUOTE_EMAIL_LEAD_TIME,
    deliveryAddress: {
      address1: quote.quote_email_delivery_address_1?.trim() ?? "",
      address2: quote.quote_email_delivery_address_2?.trim() ?? "",
      suburb: quote.quote_email_delivery_suburb?.trim() ?? "",
      state: quote.quote_email_delivery_state?.trim() ?? "",
      country: quote.quote_email_delivery_country?.trim() ?? "",
    },
    totalLineOverride,
  });

  const token = randomBytes(24).toString("hex");
  const base = siteBaseUrl().replace(/\/$/, "");
  const acceptUrl = `${base}/quote/accept/${encodeURIComponent(quote.id)}?token=${encodeURIComponent(token)}`;

  const sendResult = await sendCustomerQuoteSentEmail(supabase, {
    quoteId: id,
    to: emailTo,
    contactName: quote.contact_name,
    companyName: quote.company_name,
    plainTextBody: plainBody,
    acceptUrl,
  });

  if (!sendResult.ok) {
    return { ok: false, error: sendResult.error };
  }

  const { data: updated, error: upErr } = await supabase
    .from("quote_requests")
    .update({
      pipeline_stage: "quote",
      quote_portal_token: token,
    })
    .eq("id", id)
    .eq("pipeline_stage", "enquiry")
    .select("id")
    .maybeSingle();

  if (upErr) {
    return { ok: false, error: upErr.message };
  }
  if (!updated) {
    return {
      ok: false,
      error:
        "The quote email was sent, but the deal could not be moved to Quote sent (it may have changed). Refresh CRM and check notifications.",
    };
  }

  await supabase.from("crm_activities").insert({
    quote_request_id: id,
    kind: "stage_change",
    body: "Stage: enquiry → quote (quote email sent to customer)",
  });

  revalidatePath("/admin/crm");
  revalidatePath("/admin");
  revalidatePath(`/admin/crm/send-quote/${id}`);
  return { ok: true };
}

export async function updateQuoteCustomerEmailDraft(
  quoteId: string,
  fields: {
    quote_email_products: QuoteEmailProductLine[];
    quote_email_total_cents: number | null;
    quote_email_lead_time: string | null;
    quote_email_delivery_address_1: string | null;
    quote_email_delivery_address_2: string | null;
    quote_email_delivery_suburb: string | null;
    quote_email_delivery_state: string | null;
    quote_email_delivery_country: string | null;
  },
): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!quoteId) {
    return { ok: false, error: "Invalid id" };
  }

  const total = fields.quote_email_total_cents;
  if (total !== null && (!Number.isFinite(total) || total < 0 || !Number.isInteger(total))) {
    return { ok: false, error: "Total amount must be a valid whole number of cents (or leave blank)." };
  }

  const products = normalizeQuoteEmailProductsForSave(fields.quote_email_products);
  const first = products[0];

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("quote_requests")
    .update({
      quote_email_products: products,
      quote_email_product_id: first?.product_id?.trim() || null,
      quote_email_product_name: first?.product_name?.trim() || null,
      quote_email_total_cents: total,
      quote_email_lead_time: fields.quote_email_lead_time?.trim() || null,
      quote_email_delivery_address_1: fields.quote_email_delivery_address_1?.trim() || null,
      quote_email_delivery_address_2: fields.quote_email_delivery_address_2?.trim() || null,
      quote_email_delivery_suburb: fields.quote_email_delivery_suburb?.trim() || null,
      quote_email_delivery_state: fields.quote_email_delivery_state?.trim() || null,
      quote_email_delivery_country: fields.quote_email_delivery_country?.trim() || null,
    })
    .eq("id", quoteId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/send-quote/${quoteId}`);
  return { ok: true };
}

export async function updateQuoteEmbroideryPrintServiceDraft(
  quoteId: string,
  fields: { quote_email_embroidery_service: string | null; quote_email_print_service: string | null },
): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!quoteId) {
    return { ok: false, error: "Invalid id" };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("quote_requests")
    .update({
      quote_email_embroidery_service: fields.quote_email_embroidery_service?.trim() || null,
      quote_email_print_service: fields.quote_email_print_service?.trim() || null,
    })
    .eq("id", quoteId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/send-quote/${quoteId}`);
  return { ok: true };
}

export async function updateQuoteInternalNotes(quoteId: string, internalNotes: string): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!quoteId) {
    return { ok: false, error: "Invalid id" };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("quote_requests").update({ internal_notes: internalNotes || null }).eq("id", quoteId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  return { ok: true };
}

export async function updateQuoteFollowUp(quoteId: string, isoDateTime: string | null): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!quoteId) {
    return { ok: false, error: "Invalid id" };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("quote_requests")
    .update({ next_follow_up_at: isoDateTime })
    .eq("id", quoteId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  return { ok: true };
}

export async function updateQuoteAutomationPaused(quoteId: string, paused: boolean): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!quoteId) {
    return { ok: false, error: "Invalid id" };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("quote_requests").update({ automation_paused: paused }).eq("id", quoteId);
  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase.from("crm_activities").insert({
    quote_request_id: quoteId,
    kind: "system",
    body: paused ? "Automation reminders paused for this lead." : "Automation reminders resumed.",
  });

  revalidatePath("/admin/crm");
  return { ok: true };
}

export async function addCrmNote(quoteId: string, note: string): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const trimmed = note.trim();
  if (!quoteId || !trimmed) {
    return { ok: false, error: "Note required" };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("crm_activities").insert({
    quote_request_id: quoteId,
    kind: "note",
    body: trimmed,
  });
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  return { ok: true };
}

export async function linkQuoteToCustomer(quoteId: string, customerProfileId: string | null): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!quoteId) {
    return { ok: false, error: "Invalid id" };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("quote_requests").update({ customer_profile_id: customerProfileId }).eq("id", quoteId);
  if (error) {
    return { ok: false, error: error.message };
  }

  await supabase.from("crm_activities").insert({
    quote_request_id: quoteId,
    kind: "system",
    body: customerProfileId ? "Linked to customer profile." : "Unlinked from customer profile.",
  });

  revalidatePath("/admin/crm");
  return { ok: true };
}

export async function markQuoteContactedNow(quoteId: string): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!quoteId) {
    return { ok: false, error: "Invalid id" };
  }

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("quote_requests").update({ last_contacted_at: now }).eq("id", quoteId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  return { ok: true };
}

export async function updateCustomerProfile(
  customerProfileId: string,
  fields: {
    organisation: string;
    customer_name: string;
    email_address: string;
    contact_number: string;
    delivery_address: string;
    billing_address: string;
    login_password: string;
  },
): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!customerProfileId) {
    return { ok: false, error: "Invalid id" };
  }

  const organisation = fields.organisation.trim();
  const customer_name = fields.customer_name.trim();
  const email_address = fields.email_address.trim().toLowerCase();
  const contact_number = fields.contact_number.trim();
  const delivery_address = fields.delivery_address.trim();
  const billing_address = fields.billing_address.trim();
  const login_password = fields.login_password.trim() || null;

  if (!organisation || !customer_name || !email_address || !contact_number) {
    return { ok: false, error: "Organisation, contact name, email, and phone are required." };
  }
  if (!delivery_address || !billing_address) {
    return { ok: false, error: "Delivery and billing addresses are required." };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("customer_profiles")
    .update({
      organisation,
      customer_name,
      email_address,
      contact_number,
      delivery_address,
      billing_address,
      login_password,
    })
    .eq("id", customerProfileId);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  revalidatePath("/admin");
  return { ok: true };
}

export async function deleteCustomerProfile(customerProfileId: string): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  if (!customerProfileId) {
    return { ok: false, error: "Invalid id" };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("customer_profiles").delete().eq("id", customerProfileId);
  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/admin/crm");
  revalidatePath("/admin");
  return { ok: true };
}

const QUOTE_STORAGE_BUCKET = () => process.env.SUPABASE_STORAGE_BUCKET ?? "quote-logos";
const MAX_QUOTE_MOCKUP_BYTES = 8 * 1024 * 1024;
const MAX_QUOTE_MOCKUP_IMAGES = 12;

const MOCKUP_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);

function mimeForMockupExt(ext: string): string {
  switch (ext.toLowerCase()) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    default:
      return "application/octet-stream";
  }
}

/** Path inside bucket from Supabase public object URL. */
function storagePathFromQuotePublicUrl(publicUrl: string, bucket: string): string | null {
  try {
    const u = new URL(publicUrl);
    const segs = u.pathname.split("/").filter(Boolean);
    const pubIdx = segs.indexOf("public");
    if (pubIdx === -1 || segs[pubIdx + 1] !== bucket) return null;
    return decodeURIComponent(segs.slice(pubIdx + 2).join("/"));
  } catch {
    return null;
  }
}

export type UploadQuoteMockupsResult = { ok: true; uploadedUrls: string[] } | { ok: false; error: string };

export async function uploadQuoteMockupImages(quoteId: string, formData: FormData): Promise<UploadQuoteMockupsResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const id = quoteId?.trim();
  if (!id) {
    return { ok: false, error: "Invalid quote id." };
  }

  const files = formData
    .getAll("files")
    .filter((f): f is File => typeof File !== "undefined" && f instanceof File && f.size > 0);

  if (files.length === 0) {
    return { ok: false, error: "No image files selected." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: row, error: fetchErr } = await supabase
    .from("quote_requests")
    .select("id, quote_mockup_image_urls")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row?.id) {
    return { ok: false, error: fetchErr?.message ?? "Quote request not found." };
  }

  const existing = row.quote_mockup_image_urls ?? [];
  if (existing.length + files.length > MAX_QUOTE_MOCKUP_IMAGES) {
    return {
      ok: false,
      error: `Too many mockups (maximum ${MAX_QUOTE_MOCKUP_IMAGES} images per quote).`,
    };
  }

  const bucket = QUOTE_STORAGE_BUCKET();
  const newUrls: string[] = [];

  for (const file of files) {
    const name = file.name.toLowerCase();
    const ext = name.includes(".") ? (name.split(".").pop() ?? "") : "";
    if (!MOCKUP_IMAGE_EXTENSIONS.has(ext)) {
      return { ok: false, error: "Only JPG, PNG, WebP, and GIF mockup images are allowed." };
    }
    if (file.size > MAX_QUOTE_MOCKUP_BYTES) {
      return { ok: false, error: `Each image must be at most ${MAX_QUOTE_MOCKUP_BYTES / (1024 * 1024)}MB.` };
    }

    const filePath = `mockups/${id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const { error: upErr } = await supabase.storage
      .from(bucket)
      .upload(filePath, bytes, {
        contentType: file.type || mimeForMockupExt(ext),
        upsert: false,
      });

    if (upErr) {
      return { ok: false, error: upErr.message };
    }

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
    if (pub?.publicUrl) newUrls.push(pub.publicUrl);
  }

  const merged = [...existing, ...newUrls];
  const { error: updErr } = await supabase.from("quote_requests").update({ quote_mockup_image_urls: merged }).eq("id", id);

  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/send-quote/${id}`);
  return { ok: true, uploadedUrls: newUrls };
}

export async function removeQuoteMockupImage(quoteId: string, publicUrl: string): Promise<ActionResult> {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false, error: "Unauthorized" };
  }
  const id = quoteId?.trim();
  const url = publicUrl?.trim();
  if (!id || !url) {
    return { ok: false, error: "Invalid request." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: row, error: fetchErr } = await supabase
    .from("quote_requests")
    .select("id, quote_mockup_image_urls")
    .eq("id", id)
    .maybeSingle();

  if (fetchErr || !row?.id) {
    return { ok: false, error: fetchErr?.message ?? "Quote request not found." };
  }

  const existing = row.quote_mockup_image_urls ?? [];
  if (!existing.includes(url)) {
    return { ok: false, error: "That image is not attached to this quote." };
  }

  const bucket = QUOTE_STORAGE_BUCKET();
  const path = storagePathFromQuotePublicUrl(url, bucket);
  if (path?.startsWith(`mockups/${id}/`)) {
    await supabase.storage.from(bucket).remove([path]);
  }

  const next = existing.filter((u) => u !== url);
  const { error: updErr } = await supabase.from("quote_requests").update({ quote_mockup_image_urls: next }).eq("id", id);

  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/send-quote/${id}`);
  return { ok: true };
}
