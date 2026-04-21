import Link from "next/link";

import { AccountingExpensesSection, type AccountingExpenseRow } from "@/app/admin/(panel)/accounting/accounting-expenses-section";
import { AccountingRefundsSection, type AccountingRefundRow } from "@/app/admin/(panel)/accounting/accounting-refunds-section";
import { getPerthYmd } from "@/lib/perth-calendar";
import { createSupabaseAdminClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

type Search = {
  created?: string;
  deleted?: string;
  error?: string;
  refund_created?: string;
  refund_saved?: string;
  refund_deleted?: string;
  refund_error?: string;
};

export default async function AdminAccountingPage({ searchParams }: { searchParams: Promise<Search> }) {
  const q = await searchParams;
  const { ymd: defaultExpenseDate } = getPerthYmd();
  const { ymd: defaultRefundIssueDate } = getPerthYmd();

  let rows: AccountingExpenseRow[] = [];
  let loadError: string | null = null;

  let refundRows: AccountingRefundRow[] = [];
  let refundLoadError: string | null = null;

  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("accounting_expenses")
      .select(
        "id, expense_date, category, description, amount_cents, currency, vendor, notes, receipt_storage_path, created_at",
      )
      .order("expense_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) {
      const missingReceiptCol = error.message.includes("receipt_storage_path") || error.code === "42703";
      loadError =
        error.message.includes("accounting_expenses") ||
        error.message.includes("does not exist") ||
        error.message.includes("schema cache") ||
        error.code === "42P01" ||
        missingReceiptCol
          ? `${error.message} — In Supabase → SQL Editor, run supabase/sql-editor/patch_accounting_expenses.sql (adds table, receipt column, and storage bucket), then Settings → API → Reload schema.`
          : error.message;
    } else {
      rows = (data ?? []).map((r) => ({
        ...(r as AccountingExpenseRow),
        receipt_storage_path: (r as { receipt_storage_path?: string | null }).receipt_storage_path ?? null,
      })) as AccountingExpenseRow[];
    }
  } catch (e) {
    loadError = e instanceof Error ? e.message : "Failed to load expenses.";
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: refundData, error: refundErr } = await supabase
      .from("accounting_refunds")
      .select("id, issue_date, order_id, description, amount_cents, currency, date_refunded, xero_updated, created_at")
      .order("issue_date", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200);

    if (refundErr) {
      refundLoadError =
        refundErr.message.includes("accounting_refunds") ||
        refundErr.message.includes("does not exist") ||
        refundErr.message.includes("schema cache") ||
        refundErr.code === "42P01"
          ? `${refundErr.message} — Run supabase/sql-editor/patch_accounting_refunds.sql in Supabase SQL Editor, then Settings → API → Reload schema.`
          : refundErr.message;
    } else {
      refundRows = (refundData ?? []) as AccountingRefundRow[];
    }
  } catch (e) {
    refundLoadError = e instanceof Error ? e.message : "Failed to load refunds.";
  }

  let banner: { kind: "ok" | "err"; text: string } | null = null;
  if (q.created === "1") banner = { kind: "ok", text: "Expense saved." };
  else if (q.deleted === "1") banner = { kind: "ok", text: "Expense deleted." };
  else if (q.refund_created === "1") banner = { kind: "ok", text: "Refund added." };
  else if (q.refund_saved === "1") banner = { kind: "ok", text: "Refund updated." };
  else if (q.refund_deleted === "1") banner = { kind: "ok", text: "Refund deleted." };
  else if (q.error === "missing_description") banner = { kind: "err", text: "Description is required." };
  else if (q.error === "invalid_date") banner = { kind: "err", text: "Choose a valid expense date." };
  else if (q.error === "invalid_amount") banner = { kind: "err", text: "Enter a positive amount in AUD (e.g. 99.00)." };
  else if (q.error === "invalid_row") banner = { kind: "err", text: "Invalid request." };
  else if (q.error === "invalid_receipt") banner = { kind: "err", text: "Add a valid image file for the receipt, or clear it and save without a photo." };
  else if (q.error === "receipt_too_large") banner = { kind: "err", text: "Receipt image is too large (max 12MB)." };
  else if (q.error === "invalid_receipt_type") banner = { kind: "err", text: "Receipt must be JPEG, PNG, GIF, or WebP." };
  else if (q.refund_error === "missing_description") banner = { kind: "err", text: "Refund description is required." };
  else if (q.refund_error === "invalid_issue_date") banner = { kind: "err", text: "Choose a valid refund issue date." };
  else if (q.refund_error === "invalid_amount") banner = { kind: "err", text: "Enter a positive refund amount in AUD." };
  else if (q.refund_error === "invalid_row") banner = { kind: "err", text: "Invalid refund request." };
  else if (q.refund_error) {
    try {
      banner = { kind: "err", text: decodeURIComponent(q.refund_error.replace(/\+/g, " ")) };
    } catch {
      banner = { kind: "err", text: q.refund_error };
    }
  } else if (q.error) {
    try {
      banner = { kind: "err", text: decodeURIComponent(q.error.replace(/\+/g, " ")) };
    } catch {
      banner = { kind: "err", text: q.error };
    }
  }

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
          <Link href="/admin" className="text-brand-orange hover:underline">
            Dashboard
          </Link>{" "}
          / Accounting
        </p>
        <h1 className="mt-1 text-3xl font-medium text-brand-navy">Accounting</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          Record <strong>expenses</strong> and <strong>refunds</strong> below for a lightweight in-app log. Day-to-day
          books can still live in <strong>Xero</strong>; use descriptions and the Xero updated flag to stay aligned.
        </p>
      </header>

      {banner ? (
        <div
          className={
            banner.kind === "ok"
              ? "rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950"
              : "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-950"
          }
        >
          {banner.text}
        </div>
      ) : null}

      {loadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">{loadError}</div>
      ) : (
        <AccountingExpensesSection rows={rows} defaultExpenseDate={defaultExpenseDate} />
      )}

      {refundLoadError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
          {refundLoadError}
        </div>
      ) : (
        <AccountingRefundsSection rows={refundRows} defaultIssueDate={defaultRefundIssueDate} />
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-medium text-brand-navy">Manual workflow (Xero)</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>Open <strong>Store orders</strong> and note confirmed orders for the day.</li>
          <li>Create matching contacts / invoices in Xero (GST and line items as you use today).</li>
          <li>Use the web order reference on the Xero invoice so support can trace it.</li>
        </ol>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/admin/store-orders"
          className="rounded-xl border border-brand-orange/30 bg-brand-orange/5 p-5 shadow-sm transition hover:bg-brand-orange/10"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">Orders</p>
          <p className="mt-2 text-lg font-semibold text-brand-navy">Store orders →</p>
          <p className="mt-1 text-sm text-slate-600">Source list for what to enter in Xero</p>
        </Link>
        <a
          href="https://go.xero.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
        >
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">External</p>
          <p className="mt-2 text-lg font-semibold text-brand-navy">Open Xero →</p>
          <p className="mt-1 text-sm text-slate-600">Sign in to your Xero organisation</p>
        </a>
      </section>
    </div>
  );
}
