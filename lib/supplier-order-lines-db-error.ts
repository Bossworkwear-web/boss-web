/**
 * supplier_order_lines uses RLS with no policies; only the Supabase service role can read/write.
 * PostgREST errors are easy to misread as “run migrations” when the real issue is the anon key.
 */

export type SupplierOrderLinesDbErrorKind =
  | "missing_table"
  | "missing_daily_sheets_table"
  | "missing_click_up_sheet_list_table"
  | "missing_customer_order_id_column"
  | "rls_or_permission"
  | "missing_list_date"
  | "other";

function formatSupplierOrderLinesErrorDetail(error: { message: string; code?: string }) {
  const code = error.code?.trim();
  const msg = (error.message ?? "").trim();
  if (!msg && !code) return "";
  const parts = [msg, code ? `[${code}]` : ""].filter(Boolean).join(" ");
  return `\n\nDetails: ${parts}`;
}

/** True when the app will use the anon key for “admin” Supabase calls (RLS blocks writes; empty reads). */
export function isSupplierOrderLinesServiceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
}

export function supplierOrderLinesServiceRoleMissingMessage(): string {
  return (
    "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local. Copy the service_role secret from Supabase → Project Settings → API, " +
    "add it as SUPABASE_SERVICE_ROLE_KEY, restart the dev server, then try again. Without it, the app uses the anon key and cannot insert into supplier_order_lines (RLS has no policies for anon)."
  );
}

export function classifySupplierOrderLinesError(error: { message: string; code?: string }): SupplierOrderLinesDbErrorKind {
  const m = (error.message ?? "").toLowerCase();
  const code = error.code ?? "";

  if (
    m.includes("row-level security") ||
    m.includes("violates row-level security") ||
    (m.includes("permission denied") && m.includes("supplier_order_lines")) ||
    (code === "42501" && m.includes("supplier_order_lines"))
  ) {
    return "rls_or_permission";
  }

  if (
    m.includes("supplier_order_lines") &&
    m.includes("customer_order_id") &&
    (m.includes("schema cache") || m.includes("could not find"))
  ) {
    return "missing_customer_order_id_column";
  }

  // PostgREST: Click Up / supplier_daily_sheets (separate from supplier_order_lines).
  if (
    (code === "PGRST205" || m.includes("schema cache") || m.includes("could not find")) &&
    m.includes("supplier_daily_sheets")
  ) {
    return "missing_daily_sheets_table";
  }
  if (code === "42P01" && m.includes("supplier_daily_sheets")) {
    return "missing_daily_sheets_table";
  }

  if (
    (code === "PGRST205" || m.includes("schema cache") || m.includes("could not find")) &&
    m.includes("click_up_sheet_list")
  ) {
    return "missing_click_up_sheet_list_table";
  }
  if (code === "42P01" && m.includes("click_up_sheet_list")) {
    return "missing_click_up_sheet_list_table";
  }

  // PostgREST: table not visible to the API (never created in this project, or stale cache after CREATE).
  if (code === "PGRST205") {
    return "missing_table";
  }
  if (m.includes("schema cache") && m.includes("supplier_order_lines")) {
    return "missing_table";
  }

  if (code === "42P01" || (m.includes("does not exist") && m.includes("supplier_order_lines"))) {
    return "missing_table";
  }

  if (m.includes("column") && m.includes("list_date") && m.includes("does not exist")) {
    return "missing_list_date";
  }

  return "other";
}

export function supplierOrderLinesMutationErrorMessage(error: { message: string; code?: string }): string {
  const kind = classifySupplierOrderLinesError(error);
  if (kind === "rls_or_permission") {
    return (
      "Cannot write supplier orders: add SUPABASE_SERVICE_ROLE_KEY to .env.local (Project Settings → API → service_role secret). " +
      "The anon key cannot insert/update this table while RLS is enabled. Restart dev server after saving."
    );
  }
  if (kind === "missing_customer_order_id_column") {
    const detail = formatSupplierOrderLinesErrorDetail(error);
    return (
      "supplier_order_lines is missing the customer_order_id column (or PostgREST cache is stale). " +
      "Run supabase/migrations/20260433_supplier_order_lines_store_customer_order_id.sql in SQL Editor, or add: " +
      "ALTER TABLE public.supplier_order_lines ADD COLUMN IF NOT EXISTS customer_order_id text NOT NULL DEFAULT ''; " +
      "then NOTIFY pgrst, 'reload schema';" +
      detail
    );
  }
  if (kind === "missing_daily_sheets_table") {
    const detail = formatSupplierOrderLinesErrorDetail(error);
    return (
      "Supabase cannot see public.supplier_daily_sheets (table missing in this project, or PostgREST schema cache is stale). " +
      "In Supabase → SQL Editor, paste and run the whole file supabase/sql-editor/supplier_daily_sheets_full_setup.sql " +
      "(or run supabase/migrations/20260437_supplier_daily_sheets.sql and then NOTIFY). The script ends with NOTIFY pgrst, 'reload schema';. " +
      "Set SUPABASE_SERVICE_ROLE_KEY in .env.local, restart dev, and ensure NEXT_PUBLIC_SUPABASE_URL matches that project.\n\n" +
      "If supplier_daily_sheets already appears under Table Editor → public, run only this in SQL Editor, then reload this page:\n" +
      "NOTIFY pgrst, 'reload schema';" +
      detail
    );
  }
  if (kind === "missing_click_up_sheet_list_table") {
    const detail = formatSupplierOrderLinesErrorDetail(error);
    return (
      "Supabase cannot see public.click_up_sheet_list (table missing or PostgREST schema cache is stale). " +
      "This table stores rows for Click Up → Click up sheet list when you check Ready for Processing on Supplier orders. " +
      "In Supabase → SQL Editor, run supabase/sql-editor/click_up_sheet_list_full_setup.sql (or migration 20260439). " +
      "It ends with NOTIFY pgrst, 'reload schema';." +
      detail
    );
  }
  if (kind === "missing_table") {
    const detail = formatSupplierOrderLinesErrorDetail(error);
    return (
      "Supabase cannot see public.supplier_order_lines (table missing in this project, or PostgREST schema cache is stale). " +
      "In Supabase → SQL Editor, paste and run the whole file supabase/sql-editor/supplier_order_lines_full_setup.sql " +
      "(or run migrations through 20260433_supplier_order_lines_store_customer_order_id.sql). It ends with NOTIFY pgrst, 'reload schema';. " +
      "Set SUPABASE_SERVICE_ROLE_KEY in .env.local, restart dev, and ensure NEXT_PUBLIC_SUPABASE_URL matches that project.\n\n" +
      "If supplier_order_lines already appears under Table Editor → public, run only this in SQL Editor, then reload this page:\n" +
      "NOTIFY pgrst, 'reload schema';" +
      detail
    );
  }
  if (kind === "missing_list_date") {
    return (
      "Column list_date is missing. In Supabase → SQL Editor, run the full SQL from " +
      "supabase/migrations/20260428_supplier_order_lines_list_date.sql."
    );
  }
  return error.message;
}

export function supplierOrderLinesLoadErrorMessage(error: { message: string; code?: string }): string {
  const kind = classifySupplierOrderLinesError(error);
  if (kind === "rls_or_permission") {
    return (
      "Cannot load supplier orders: set SUPABASE_SERVICE_ROLE_KEY in .env.local (service role bypasses RLS). " +
      "Restart the dev server after saving."
    );
  }
  if (kind === "missing_customer_order_id_column") {
    return supplierOrderLinesMutationErrorMessage(error);
  }
  if (kind === "missing_daily_sheets_table") {
    return supplierOrderLinesMutationErrorMessage(error);
  }
  if (kind === "missing_click_up_sheet_list_table") {
    return supplierOrderLinesMutationErrorMessage(error);
  }
  if (kind === "missing_table") {
    return supplierOrderLinesMutationErrorMessage(error);
  }
  if (kind === "missing_list_date") {
    return supplierOrderLinesMutationErrorMessage(error);
  }
  return error.message;
}
