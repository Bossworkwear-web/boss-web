import type { SupabaseClient } from "@supabase/supabase-js";

import { ACCOUNTING_EXPENSE_RECEIPTS_BUCKET } from "@/lib/accounting-expense-receipts";
import { addCalendarDaysYmd, getPerthYmd } from "@/lib/perth-calendar";

/** Non–Equipment receipt images: remove after this many days from `expense_date` (Perth calendar). */
export const ACCOUNTING_RECEIPT_RETENTION_NON_EQUIPMENT_DAYS = 365;

/** Equipment category receipt images: remove after this many days from `expense_date`. */
export const ACCOUNTING_RECEIPT_RETENTION_EQUIPMENT_DAYS = 365 * 5;

export function isAccountingEquipmentCategory(category: string | null | undefined): boolean {
  return (category ?? "").trim().toLowerCase() === "equipment";
}

/**
 * Whether the receipt object should be purged (storage + DB path cleared), based on Perth `expense_date`.
 * Expense rows are never deleted.
 */
export function accountingReceiptShouldPurge(params: {
  expenseDateYmd: string;
  category: string | null | undefined;
  todayYmd: string;
}): boolean {
  const { expenseDateYmd, category, todayYmd } = params;
  const oneYearCutoff = addCalendarDaysYmd(todayYmd, -ACCOUNTING_RECEIPT_RETENTION_NON_EQUIPMENT_DAYS);
  const fiveYearCutoff = addCalendarDaysYmd(todayYmd, -ACCOUNTING_RECEIPT_RETENTION_EQUIPMENT_DAYS);
  if (expenseDateYmd >= oneYearCutoff) {
    return false;
  }
  if (isAccountingEquipmentCategory(category)) {
    return expenseDateYmd < fiveYearCutoff;
  }
  return true;
}

export type PurgeAccountingReceiptsResult = {
  ok: boolean;
  today_ymd: string;
  one_year_cutoff_ymd: string;
  five_year_cutoff_ymd: string;
  candidates_from_db: number;
  purged: number;
  skipped_ineligible: number;
  errors: string[];
};

/**
 * Deletes expired receipt objects from storage and sets `receipt_storage_path` to null.
 * Uses `expense_date` in Australia/Perth calendar sense (YYYY-MM-DD string compare).
 */
export async function purgeAccountingReceiptsPastRetention(
  supabase: SupabaseClient,
  options?: { maxRows?: number },
): Promise<PurgeAccountingReceiptsResult> {
  const maxRows = options?.maxRows ?? 2000;
  const { ymd: todayYmd } = getPerthYmd();
  const oneYearCutoff = addCalendarDaysYmd(todayYmd, -ACCOUNTING_RECEIPT_RETENTION_NON_EQUIPMENT_DAYS);
  const fiveYearCutoff = addCalendarDaysYmd(todayYmd, -ACCOUNTING_RECEIPT_RETENTION_EQUIPMENT_DAYS);

  const errors: string[] = [];
  let purged = 0;
  let skippedIneligible = 0;

  const { data: rows, error: selErr } = await supabase
    .from("accounting_expenses")
    .select("id, category, expense_date, receipt_storage_path")
    .not("receipt_storage_path", "is", null)
    .lt("expense_date", oneYearCutoff)
    .order("expense_date", { ascending: true })
    .limit(maxRows);

  if (selErr) {
    return {
      ok: false,
      today_ymd: todayYmd,
      one_year_cutoff_ymd: oneYearCutoff,
      five_year_cutoff_ymd: fiveYearCutoff,
      candidates_from_db: 0,
      purged: 0,
      skipped_ineligible: 0,
      errors: [selErr.message],
    };
  }

  const list = rows ?? [];

  for (const row of list) {
    const path = (row.receipt_storage_path ?? "").trim();
    if (!path) continue;

    const expenseDate = String(row.expense_date ?? "").slice(0, 10);
    if (!accountingReceiptShouldPurge({ expenseDateYmd: expenseDate, category: row.category, todayYmd })) {
      skippedIneligible += 1;
      continue;
    }

    const { error: rmErr } = await supabase.storage.from(ACCOUNTING_EXPENSE_RECEIPTS_BUCKET).remove([path]);
    if (rmErr) {
      errors.push(`${row.id}: storage: ${rmErr.message}`);
      continue;
    }

    const { error: upErr } = await supabase.from("accounting_expenses").update({ receipt_storage_path: null }).eq("id", row.id);
    if (upErr) {
      errors.push(`${row.id}: db: ${upErr.message}`);
      continue;
    }

    purged += 1;
  }

  return {
    ok: errors.length === 0,
    today_ymd: todayYmd,
    one_year_cutoff_ymd: oneYearCutoff,
    five_year_cutoff_ymd: fiveYearCutoff,
    candidates_from_db: list.length,
    purged,
    skipped_ineligible: skippedIneligible,
    errors,
  };
}
