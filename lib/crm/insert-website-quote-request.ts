import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

type QuoteRequestInsert = Database["public"]["Tables"]["quote_requests"]["Insert"];

const OPTIONAL_JSONB_COLUMNS = ["admin_customer_quote_sheet", "website_quote_submission"] as const;

type OptionalJsonbColumn = (typeof OPTIONAL_JSONB_COLUMNS)[number];

function isMissingColumnError(error: { message?: string } | null, column: string) {
  return Boolean(error?.message?.includes(column));
}

function stashOptionalJsonbInNotes(
  notes: string | null | undefined,
  payload: QuoteRequestInsert,
  missing: OptionalJsonbColumn[],
): string | null {
  const blocks: string[] = [];
  for (const column of missing) {
    const value = payload[column];
    if (value == null) continue;
    blocks.push(`[${column}]\n${JSON.stringify(value)}`);
  }
  if (blocks.length === 0) {
    return notes?.trim() ? notes.trim() : null;
  }
  return [notes?.trim() ? notes.trim() : null, ...blocks].filter(Boolean).join("\n\n");
}

function isMissingOptionalJsonbColumnError(error: { message?: string } | null) {
  return OPTIONAL_JSONB_COLUMNS.some((column) => isMissingColumnError(error, column));
}

function stripOptionalJsonbColumns(payload: QuoteRequestInsert) {
  const fallback: QuoteRequestInsert = { ...payload };
  const stripped: OptionalJsonbColumn[] = [];
  for (const column of OPTIONAL_JSONB_COLUMNS) {
    if (fallback[column] != null) {
      stripped.push(column);
    }
    delete fallback[column];
  }
  return { fallback, stripped };
}

/** Insert a website quote; retries without optional JSONB columns when the DB schema is behind. */
export async function insertWebsiteQuoteRequest(
  supabase: SupabaseClient<Database>,
  payload: QuoteRequestInsert,
) {
  const first = await supabase.from("quote_requests").insert(payload).select("id").single();
  if (!first.error && first.data?.id) {
    return first;
  }

  if (!isMissingOptionalJsonbColumnError(first.error)) {
    return first;
  }

  const { fallback, stripped } = stripOptionalJsonbColumns(payload);
  fallback.notes = stashOptionalJsonbInNotes(fallback.notes, payload, stripped);

  return supabase.from("quote_requests").insert(fallback).select("id").single();
}
