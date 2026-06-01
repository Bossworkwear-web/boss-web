"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSessionForPathSegment } from "@/lib/admin-auth";
import {
  PROMOTION_CODE_STATUSES,
  PROMOTION_DISCOUNT_TYPES,
  normalizePromotionCodeInput,
  type PromotionCodeStatus,
  type PromotionDiscountType,
} from "@/lib/promotion-codes";
import { createSupabaseAdminClient } from "@/lib/supabase";

const PROMO_ADMIN_PATH = "/admin/promotion";

function redirectWithError(message: string): never {
  redirect(`${PROMO_ADMIN_PATH}?error=${encodeURIComponent(message.slice(0, 400))}`);
}

async function guardAdmin() {
  try {
    await assertAdminSessionForPathSegment(PROMO_ADMIN_PATH);
  } catch {
    redirect("/admin/login");
  }
}

function parseDiscountType(raw: string): PromotionDiscountType | null {
  const t = raw.trim() as PromotionDiscountType;
  return PROMOTION_DISCOUNT_TYPES.includes(t) ? t : null;
}

function parseStatus(raw: string): PromotionCodeStatus | null {
  const t = raw.trim() as PromotionCodeStatus;
  return PROMOTION_CODE_STATUSES.includes(t) ? t : null;
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return n;
}

function parseOptionalInt(raw: string): number | null {
  const n = parseOptionalNumber(raw);
  if (n == null) return null;
  return Math.floor(n);
}

function parseOptionalIso(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  const ms = Date.parse(t);
  if (Number.isNaN(ms)) return null;
  return new Date(ms).toISOString();
}

export async function createPromotionCode(formData: FormData): Promise<void> {
  await guardAdmin();

  const code = normalizePromotionCodeInput((formData.get("code") ?? "").toString());
  if (code.length < 3 || code.length > 32) {
    redirectWithError("Code must be 3–32 characters.");
  }

  const discountType = parseDiscountType((formData.get("discount_type") ?? "").toString());
  if (!discountType) {
    redirectWithError("Invalid discount type.");
  }

  const discountValue = Number((formData.get("discount_value") ?? "").toString());
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    redirectWithError("Discount value must be greater than zero.");
  }
  if (discountType === "percent" && discountValue > 100) {
    redirectWithError("Percent discount cannot exceed 100.");
  }

  const minSubtotal = parseOptionalNumber((formData.get("min_subtotal_aud") ?? "0").toString()) ?? 0;
  if (minSubtotal < 0) {
    redirectWithError("Minimum subtotal cannot be negative.");
  }

  const maxRedemptions = parseOptionalInt((formData.get("max_redemptions") ?? "").toString());
  const maxPerCustomer = parseOptionalInt((formData.get("max_redemptions_per_customer") ?? "1").toString());
  const startsAt = parseOptionalIso((formData.get("starts_at") ?? "").toString());
  const endsAt = parseOptionalIso((formData.get("ends_at") ?? "").toString());
  const description = (formData.get("description") ?? "").toString().trim() || null;

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("promotion_codes").insert({
    code,
    description,
    discount_type: discountType,
    discount_value: discountValue,
    min_subtotal_aud: minSubtotal,
    starts_at: startsAt,
    ends_at: endsAt,
    max_redemptions: maxRedemptions,
    max_redemptions_per_customer: maxPerCustomer,
    status: "active",
    updated_at: now,
  });

  if (error) {
    const msg = error.message.includes("promotion_codes")
      ? `${error.message} — Apply supabase/migrations/20260518_promotion_codes.sql in Supabase SQL Editor.`
      : error.message;
    redirectWithError(msg);
  }

  revalidatePath(PROMO_ADMIN_PATH);
  redirect(`${PROMO_ADMIN_PATH}?created=1`);
}

export async function updatePromotionCode(formData: FormData): Promise<void> {
  await guardAdmin();

  const id = (formData.get("id") ?? "").toString().trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    redirectWithError("Invalid promotion id.");
  }

  const discountType = parseDiscountType((formData.get("discount_type") ?? "").toString());
  if (!discountType) {
    redirectWithError("Invalid discount type.");
  }

  const discountValue = Number((formData.get("discount_value") ?? "").toString());
  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    redirectWithError("Discount value must be greater than zero.");
  }
  if (discountType === "percent" && discountValue > 100) {
    redirectWithError("Percent discount cannot exceed 100.");
  }

  const status = parseStatus((formData.get("status") ?? "active").toString()) ?? "active";
  const minSubtotal = parseOptionalNumber((formData.get("min_subtotal_aud") ?? "0").toString()) ?? 0;
  const maxRedemptions = parseOptionalInt((formData.get("max_redemptions") ?? "").toString());
  const maxPerCustomer = parseOptionalInt((formData.get("max_redemptions_per_customer") ?? "").toString());
  const startsAt = parseOptionalIso((formData.get("starts_at") ?? "").toString());
  const endsAt = parseOptionalIso((formData.get("ends_at") ?? "").toString());
  const description = (formData.get("description") ?? "").toString().trim() || null;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("promotion_codes")
    .update({
      description,
      discount_type: discountType,
      discount_value: discountValue,
      min_subtotal_aud: minSubtotal,
      starts_at: startsAt,
      ends_at: endsAt,
      max_redemptions: maxRedemptions,
      max_redemptions_per_customer: maxPerCustomer,
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    redirectWithError(error.message);
  }

  revalidatePath(PROMO_ADMIN_PATH);
  redirect(`${PROMO_ADMIN_PATH}?updated=1`);
}

export async function setPromotionCodeStatus(formData: FormData): Promise<void> {
  await guardAdmin();

  const id = (formData.get("id") ?? "").toString().trim();
  const status = parseStatus((formData.get("status") ?? "").toString());
  if (!id || !status) {
    redirectWithError("Invalid request.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("promotion_codes")
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(status === "expired" ? { ends_at: new Date().toISOString() } : {}),
    })
    .eq("id", id);
  if (error) {
    redirectWithError(error.message);
  }

  revalidatePath(PROMO_ADMIN_PATH);
  redirect(`${PROMO_ADMIN_PATH}?updated=1`);
}

export async function markPromotionCodeSent(formData: FormData): Promise<void> {
  await guardAdmin();

  const id = (formData.get("id") ?? "").toString().trim();
  const sentToEmail = (formData.get("sent_to_email") ?? "").toString().trim().toLowerCase();
  if (!id || !sentToEmail || !sentToEmail.includes("@")) {
    redirectWithError("Enter a valid recipient email.");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("promotion_codes")
    .update({
      sent_to_email: sentToEmail,
      sent_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    redirectWithError(error.message);
  }

  revalidatePath(PROMO_ADMIN_PATH);
  redirect(`${PROMO_ADMIN_PATH}?sent=1`);
}
