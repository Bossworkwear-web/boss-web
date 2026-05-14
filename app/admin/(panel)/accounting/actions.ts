"use server";

import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { assertAdminSession } from "@/lib/admin-auth";
import {
  ACCOUNTING_EXPENSE_RECEIPTS_BUCKET,
  contentTypeForAccountingReceipt,
  extForAccountingReceiptUpload,
  removeAccountingReceiptObject,
  validateAccountingReceiptFile,
} from "@/lib/accounting-expense-receipts";
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

export async function createAccountingExpense(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const description = normalizeText(formData.get("description"), 500);
  if (!description) {
    redirect("/admin/accounting?error=missing_description");
  }

  const expenseDateRaw = (formData.get("expense_date") ?? "").toString().trim();
  const expenseDate = YMD_RE.test(expenseDateRaw) ? expenseDateRaw : null;
  if (!expenseDate) {
    redirect("/admin/accounting?error=invalid_date");
  }

  const amountCents = parseAudToCents((formData.get("amount_aud") ?? "").toString());
  if (amountCents == null || amountCents === 0) {
    redirect("/admin/accounting?error=invalid_amount");
  }

  const supabase = createSupabaseAdminClient();

  const rawReceipt = formData.get("receipt");
  let receiptStoragePath: string | null = null;
  let uploadedPath: string | null = null;

  if (rawReceipt instanceof File && rawReceipt.size > 0) {
    const check = validateAccountingReceiptFile(rawReceipt);
    if (!check.ok) {
      redirect(`/admin/accounting?error=${check.error}`);
    }
    const ext = extForAccountingReceiptUpload(rawReceipt);
    const storagePath = `receipts/${randomUUID()}${ext}`;
    const buf = new Uint8Array(await rawReceipt.arrayBuffer());
    const { error: upErr } = await supabase.storage.from(ACCOUNTING_EXPENSE_RECEIPTS_BUCKET).upload(storagePath, buf, {
      contentType: contentTypeForAccountingReceipt(rawReceipt),
      upsert: false,
      cacheControl: "3600",
    });
    if (upErr) {
      const short = upErr.message.length > 400 ? `${upErr.message.slice(0, 400)}…` : upErr.message;
      redirect(`/admin/accounting?error=${encodeURIComponent(short)}`);
    }
    uploadedPath = storagePath;
    receiptStoragePath = storagePath;
  }

  const { error } = await supabase.from("accounting_expenses").insert({
    expense_date: expenseDate,
    category: normalizeText(formData.get("category"), 120),
    description,
    amount_cents: amountCents,
    currency: "AUD",
    vendor: normalizeText(formData.get("vendor"), 200),
    notes: normalizeText(formData.get("notes"), 2000),
    receipt_storage_path: receiptStoragePath,
  });

  if (error) {
    if (uploadedPath) {
      await supabase.storage.from(ACCOUNTING_EXPENSE_RECEIPTS_BUCKET).remove([uploadedPath]);
    }
    const missing =
      error.message.includes("accounting_expenses") ||
      error.message.includes("does not exist") ||
      error.message.includes("schema cache") ||
      error.message.includes("receipt_storage_path") ||
      error.code === "42P01" ||
      error.code === "42703";
    const msg = missing
      ? "Create / update: run supabase/sql-editor/patch_accounting_expenses.sql in Supabase SQL Editor (or migrations 20260462 + 20260463), then Settings → API → Reload schema."
      : error.message;
    const short = msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
    redirect(`/admin/accounting?error=${encodeURIComponent(short)}`);
  }

  revalidatePath("/admin/accounting");
  redirect("/admin/accounting?created=1");
}

export async function deleteAccountingExpense(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const id = (formData.get("id") ?? "").toString().trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    redirect("/admin/accounting?error=invalid_row");
  }

  const supabase = createSupabaseAdminClient();
  const { data: row, error: selErr } = await supabase
    .from("accounting_expenses")
    .select("receipt_storage_path")
    .eq("id", id)
    .maybeSingle();

  if (selErr) {
    const missingCol = selErr.message.includes("receipt_storage_path") || selErr.code === "42703";
    const msg = missingCol
      ? "Add receipt column + bucket: run supabase/sql-editor/patch_accounting_expenses.sql in SQL Editor, then Settings → API → Reload schema."
      : selErr.message;
    const short = msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
    redirect(`/admin/accounting?error=${encodeURIComponent(short)}`);
  }

  const receiptPath = row?.receipt_storage_path ?? null;

  const { error } = await supabase.from("accounting_expenses").delete().eq("id", id);

  if (error) {
    const missing =
      error.message.includes("accounting_expenses") ||
      error.message.includes("does not exist") ||
      error.message.includes("schema cache") ||
      error.code === "42P01";
    const msg = missing
      ? "Create the table: run supabase/sql-editor/patch_accounting_expenses.sql in Supabase SQL Editor, then Settings → API → Reload schema."
      : error.message;
    const short = msg.length > 400 ? `${msg.slice(0, 400)}…` : msg;
    redirect(`/admin/accounting?error=${encodeURIComponent(short)}`);
  }

  await removeAccountingReceiptObject(supabase, receiptPath);

  revalidatePath("/admin/accounting");
  redirect("/admin/accounting?deleted=1");
}
