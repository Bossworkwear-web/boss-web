"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSession } from "@/lib/admin-auth";
import { createSupabaseAdminClient } from "@/lib/supabase";

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseAudToCents(raw: string): number | null {
  const t = raw.replace(/,/g, ".").replace(/[^\d.-]/g, "").trim();
  if (t === "" || t === "-" || t === ".") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

function normalizeText(raw: FormDataEntryValue | null, max = 2000): string {
  const s = (raw ?? "").toString().trim();
  if (s.length <= max) return s;
  return s.slice(0, max);
}

function optionalYmd(raw: FormDataEntryValue | null): string | null {
  const t = (raw ?? "").toString().trim();
  if (!t) return null;
  return YMD_RE.test(t) ? t : null;
}

function xeroUpdatedFromForm(formData: FormData): boolean {
  return formData.get("xero_updated") === "on";
}

export async function createAccountingRefund(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const description = normalizeText(formData.get("description"), 500);
  if (!description) {
    redirect("/admin/accounting?refund_error=missing_description");
  }

  const issueDateRaw = (formData.get("issue_date") ?? "").toString().trim();
  const issueDate = YMD_RE.test(issueDateRaw) ? issueDateRaw : null;
  if (!issueDate) {
    redirect("/admin/accounting?refund_error=invalid_issue_date");
  }

  const amountCents = parseAudToCents((formData.get("amount_aud") ?? "").toString());
  if (amountCents == null || amountCents === 0) {
    redirect("/admin/accounting?refund_error=invalid_amount");
  }

  const dateRefunded = optionalYmd(formData.get("date_refunded"));

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("accounting_refunds").insert({
    issue_date: issueDate,
    order_id: normalizeText(formData.get("order_id"), 120),
    description,
    amount_cents: amountCents,
    currency: "AUD",
    date_refunded: dateRefunded,
    xero_updated: xeroUpdatedFromForm(formData),
  });

  if (error) {
    const missing =
      error.message.includes("accounting_refunds") ||
      error.message.includes("does not exist") ||
      error.message.includes("schema cache") ||
      error.code === "42P01";
    const msg = missing
      ? "Create refunds table: run supabase/sql-editor/patch_accounting_refunds.sql in Supabase SQL Editor, then Settings → API → Reload schema."
      : error.message;
    const short = msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
    redirect(`/admin/accounting?refund_error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/accounting");
  redirect("/admin/accounting?refund_created=1");
}

export async function updateAccountingRefund(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const id = (formData.get("id") ?? "").toString().trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    redirect("/admin/accounting?refund_error=invalid_row");
  }

  const description = normalizeText(formData.get("description"), 500);
  if (!description) {
    redirect("/admin/accounting?refund_error=missing_description");
  }

  const issueDateRaw = (formData.get("issue_date") ?? "").toString().trim();
  const issueDate = YMD_RE.test(issueDateRaw) ? issueDateRaw : null;
  if (!issueDate) {
    redirect("/admin/accounting?refund_error=invalid_issue_date");
  }

  const amountCents = parseAudToCents((formData.get("amount_aud") ?? "").toString());
  if (amountCents == null || amountCents === 0) {
    redirect("/admin/accounting?refund_error=invalid_amount");
  }

  const dateRefunded = optionalYmd(formData.get("date_refunded"));

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("accounting_refunds")
    .update({
      issue_date: issueDate,
      order_id: normalizeText(formData.get("order_id"), 120),
      description,
      amount_cents: amountCents,
      date_refunded: dateRefunded,
      xero_updated: xeroUpdatedFromForm(formData),
    })
    .eq("id", id);

  if (error) {
    const short = error.message.length > 400 ? `${error.message.slice(0, 400)}…` : error.message;
    redirect(`/admin/accounting?refund_error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/accounting");
  redirect("/admin/accounting?refund_saved=1");
}

export async function deleteAccountingRefund(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const id = (formData.get("id") ?? "").toString().trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    redirect("/admin/accounting?refund_error=invalid_row");
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("accounting_refunds").delete().eq("id", id);

  if (error) {
    const missing =
      error.message.includes("accounting_refunds") ||
      error.message.includes("does not exist") ||
      error.message.includes("schema cache") ||
      error.code === "42P01";
    const msg = missing
      ? "Create refunds table: run supabase/sql-editor/patch_accounting_refunds.sql in Supabase SQL Editor, then Settings → API → Reload schema."
      : error.message;
    const short = msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
    redirect(`/admin/accounting?refund_error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/accounting");
  redirect("/admin/accounting?refund_deleted=1");
}
