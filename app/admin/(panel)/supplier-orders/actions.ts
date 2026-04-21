"use server";

import { revalidatePath } from "next/cache";

import { assertAdminSession } from "@/lib/admin-auth";
import {
  guardCustomerOrderNumberNotInCompleteOrdersQueue,
} from "@/lib/complete-orders-queue-mutation-block";
import type { Database } from "@/lib/database.types";
import { resolveSupplierNamesByProductKeys } from "@/lib/supplier-line-catalog-supplier";
import { supplierPrefixFromSheetProductId } from "@/lib/supplier-prefix-from-product-id";
import { normalizeSupplierOrderLineSupplierValue } from "@/lib/supplier-order-supplier-normalize";
import {
  classifySupplierOrderLinesError,
  supplierOrderLinesMutationErrorMessage,
} from "@/lib/supplier-order-lines-db-error";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type SupplierOrderMutationResult = { ok: true } | { ok: false; error: string };

type Row = Database["public"]["Tables"]["supplier_order_lines"]["Row"];
export type SupplierOrderLineRow = Row;

const MAX_LEN = 500;
const MAX_NOTES = 4000;

function clampStr(s: string, max: number) {
  return s.trim().slice(0, max);
}

function parseOptionalDate(v: string | null | undefined): string | null {
  if (v == null || v === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  return v;
}

function parseListDateYmd(v: string): string | null {
  const s = v.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function parseQty(n: number) {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(1_000_000, Math.floor(n));
}

function parseCents(n: number) {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(999_999_999, Math.round(n));
}

async function assertAdmin() {
  try {
    await assertAdminSession();
  } catch {
    return { ok: false as const, error: "Unauthorized" };
  }
  return { ok: true as const };
}

export async function createSupplierOrderLine(
  listDateYmd: string,
  /** Optional initial `notes` (e.g. `"Manual Input"` from Admin → Add row). */
  initialNotes?: string,
): Promise<SupplierOrderMutationResult & { row?: SupplierOrderLineRow }> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const listDate = parseListDateYmd(listDateYmd);
  if (!listDate) {
    return { ok: false, error: "Invalid worksheet date" };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const insertPayload: Database["public"]["Tables"]["supplier_order_lines"]["Insert"] = {
      list_date: listDate,
      notes: (initialNotes ?? "").slice(0, MAX_NOTES),
    };
    const { data, error } = await supabase.from("supplier_order_lines").insert(insertPayload).select().single();

    if (error) {
      return { ok: false, error: supplierOrderLinesMutationErrorMessage(error) };
    }

    if (!data) {
      return { ok: false, error: "No row returned" };
    }

    revalidatePath("/admin/supplier-orders");
    revalidatePath("/admin/reports");
    return { ok: true, row: data as Row };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Insert failed";
    return { ok: false, error: msg };
  }
}

export type SupplierOrderLinePatch = Partial<{
  supplier: string;
  customer_order_id: string;
  product_id: string;
  colour: string;
  size: string;
  quantity: number;
  ordered_date: string | null;
  received_date: string | null;
  notes: string;
  unit_price_cents: number;
  list_date: string;
  sheet_row_ok: boolean;
}>;

/** One line’s full worksheet fields + OK flag (used when saving the whole day before Ready). */
export type SupplierDaySheetLineSnapshot = {
  id: string;
  supplier: string;
  customer_order_id: string;
  product_id: string;
  colour: string;
  size: string;
  quantity: number;
  ordered_date: string | null;
  received_date: string | null;
  notes: string;
  unit_price_cents: number;
  sheet_row_ok: boolean;
};

export async function updateSupplierOrderLine(
  id: string,
  patch: SupplierOrderLinePatch,
): Promise<SupplierOrderMutationResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const uuid = id.trim();
  if (!uuid) return { ok: false, error: "Invalid id" };

  const row: Record<string, unknown> = {};

  if (patch.supplier !== undefined) row.supplier = clampStr(patch.supplier.toUpperCase(), MAX_LEN);
  if (patch.customer_order_id !== undefined)
    row.customer_order_id = clampStr(patch.customer_order_id, MAX_LEN);
  if (patch.product_id !== undefined) row.product_id = clampStr(patch.product_id.toUpperCase(), MAX_LEN);
  if (patch.colour !== undefined) row.colour = clampStr(patch.colour, MAX_LEN);
  if (patch.size !== undefined) row.size = clampStr(patch.size, MAX_LEN);
  if (patch.quantity !== undefined) row.quantity = parseQty(patch.quantity);
  if (patch.ordered_date !== undefined) row.ordered_date = parseOptionalDate(patch.ordered_date);
  if (patch.received_date !== undefined) row.received_date = parseOptionalDate(patch.received_date);
  if (patch.notes !== undefined) row.notes = patch.notes.slice(0, MAX_NOTES);
  if (patch.unit_price_cents !== undefined) row.unit_price_cents = parseCents(patch.unit_price_cents);
  if (patch.list_date !== undefined) {
    const ld = parseListDateYmd(patch.list_date);
    if (!ld) {
      return { ok: false, error: "Invalid worksheet date" };
    }
    row.list_date = ld;
  }
  if (patch.sheet_row_ok !== undefined) row.sheet_row_ok = Boolean(patch.sheet_row_ok);

  if (Object.keys(row).length === 0) return { ok: true };

  row.updated_at = new Date().toISOString();

  try {
    const supabase = createSupabaseAdminClient();
    const { data: prior, error: priorErr } = await supabase
      .from("supplier_order_lines")
      .select("customer_order_id")
      .eq("id", uuid)
      .maybeSingle();
    if (priorErr || !prior) {
      return { ok: false, error: "Line not found." };
    }
    const effectiveOrderNumber = (
      patch.customer_order_id !== undefined ? String(patch.customer_order_id) : prior.customer_order_id ?? ""
    ).trim();
    if (effectiveOrderNumber) {
      const qg = await guardCustomerOrderNumberNotInCompleteOrdersQueue(effectiveOrderNumber);
      if (!qg.ok) {
        return qg;
      }
    }

    const { error } = await supabase.from("supplier_order_lines").update(row).eq("id", uuid);

    if (error) {
      return { ok: false, error: supplierOrderLinesMutationErrorMessage(error) };
    }

    revalidatePath("/admin/supplier-orders");
    revalidatePath("/admin/reports");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}

/** Persist every line on the worksheet in one pass (DOM snapshot from the client). Revalidates once at the end. */
export async function saveSupplierOrdersDaySheetSnapshot(
  listDateYmd: string,
  lines: SupplierDaySheetLineSnapshot[],
): Promise<SupplierOrderMutationResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const listDate = parseListDateYmd(listDateYmd);
  if (!listDate) {
    return { ok: false, error: "Invalid worksheet date" };
  }

  if (lines.length === 0) {
    return { ok: true };
  }

  const ids = lines.map((l) => l.id.trim()).filter(Boolean);
  if (ids.length !== lines.length) {
    return { ok: false, error: "Invalid line id" };
  }

  try {
    const supabase = createSupabaseAdminClient();
    const { data: existingRows, error: existErr } = await supabase
      .from("supplier_order_lines")
      .select("id,list_date")
      .in("id", ids);

    if (existErr) {
      return { ok: false, error: supplierOrderLinesMutationErrorMessage(existErr) };
    }
    const byId = new Map((existingRows ?? []).map((r) => [r.id, r.list_date]));
    if (byId.size !== ids.length) {
      return { ok: false, error: "One or more lines were not found." };
    }
    for (const id of ids) {
      if (byId.get(id) !== listDate) {
        return { ok: false, error: "Worksheet date does not match one or more lines." };
      }
    }

    const seenOrder = new Set<string>();
    for (const line of lines) {
      const oid = clampStr(line.customer_order_id, MAX_LEN).trim();
      if (oid && !seenOrder.has(oid)) {
        seenOrder.add(oid);
        const qg = await guardCustomerOrderNumberNotInCompleteOrdersQueue(oid);
        if (!qg.ok) {
          return qg;
        }
      }
    }

    const nowIso = new Date().toISOString();
    for (const line of lines) {
      const row: Database["public"]["Tables"]["supplier_order_lines"]["Update"] = {
        supplier: clampStr(normalizeSupplierOrderLineSupplierValue(line.supplier), MAX_LEN),
        customer_order_id: clampStr(line.customer_order_id, MAX_LEN),
        product_id: clampStr(line.product_id.toUpperCase(), MAX_LEN),
        colour: clampStr(line.colour, MAX_LEN),
        size: clampStr(line.size, MAX_LEN),
        quantity: parseQty(line.quantity),
        ordered_date: parseOptionalDate(line.ordered_date),
        received_date: parseOptionalDate(line.received_date),
        notes: line.notes.slice(0, MAX_NOTES),
        unit_price_cents: parseCents(line.unit_price_cents),
        sheet_row_ok: Boolean(line.sheet_row_ok),
        updated_at: nowIso,
      };
      const { error: updErr } = await supabase.from("supplier_order_lines").update(row).eq("id", line.id.trim());
      if (updErr) {
        return { ok: false, error: supplierOrderLinesMutationErrorMessage(updErr) };
      }
    }

    revalidatePath("/admin/supplier-orders");
    revalidatePath("/admin/reports");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return { ok: false, error: msg };
  }
}

export type ApplyCatalogSupplierResult = { ok: true; supplier?: string } | { ok: false; error: string };

/** When supplier is still blank, set short prefix from multi-part `product_id` (e.g. `fb-…`) or else `products.supplier_name`. */
export async function applyCatalogSupplierNameIfEmpty(
  lineId: string,
  productIdRaw: string,
): Promise<ApplyCatalogSupplierResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const id = lineId.trim();
  const pid = productIdRaw.trim();
  if (!id || !pid) return { ok: true };

  try {
    const supabase = createSupabaseAdminClient();
    const { data: line, error: lineErr } = await supabase
      .from("supplier_order_lines")
      .select("supplier, customer_order_id")
      .eq("id", id)
      .maybeSingle();

    if (lineErr || !line) {
      return { ok: false, error: "Line not found." };
    }
    const orderNum = (line.customer_order_id ?? "").trim();
    if (orderNum) {
      const qg = await guardCustomerOrderNumberNotInCompleteOrdersQueue(orderNum);
      if (!qg.ok) {
        return qg;
      }
    }
    if ((line.supplier ?? "").trim()) {
      return { ok: true };
    }

    const fromPrefix = supplierPrefixFromSheetProductId(pid);
    if (fromPrefix) {
      const supplier = clampStr(normalizeSupplierOrderLineSupplierValue(fromPrefix), MAX_LEN);
      const { error: updErr } = await supabase
        .from("supplier_order_lines")
        .update({ supplier, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (updErr) {
        return { ok: false, error: supplierOrderLinesMutationErrorMessage(updErr) };
      }

      revalidatePath("/admin/supplier-orders");
      revalidatePath("/admin/reports");
      return { ok: true, supplier };
    }

    const map = await resolveSupplierNamesByProductKeys(supabase, [pid]);
    const sn = map.get(pid);
    if (!sn) {
      return { ok: true };
    }

    const supplier = clampStr(normalizeSupplierOrderLineSupplierValue(sn), MAX_LEN);
    const { error: updErr } = await supabase
      .from("supplier_order_lines")
      .update({ supplier, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updErr) {
      return { ok: false, error: supplierOrderLinesMutationErrorMessage(updErr) };
    }

    revalidatePath("/admin/supplier-orders");
    revalidatePath("/admin/reports");
    return { ok: true, supplier };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}

export async function setSupplierDailySheetReadyForProcessing(
  listDateYmd: string,
  ready: boolean,
): Promise<SupplierOrderMutationResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const listDate = parseListDateYmd(listDateYmd);
  if (!listDate) {
    return { ok: false, error: "Invalid worksheet date" };
  }

  try {
    const supabase = createSupabaseAdminClient();

    if (ready) {
      const { data: lineRows, error: linesErr } = await supabase
        .from("supplier_order_lines")
        .select("customer_order_id")
        .eq("list_date", listDate);
      if (linesErr) {
        return { ok: false, error: supplierOrderLinesMutationErrorMessage(linesErr) };
      }
      const seen = new Set<string>();
      for (const lr of lineRows ?? []) {
        const oid = (lr.customer_order_id ?? "").trim();
        if (!oid || seen.has(oid)) continue;
        seen.add(oid);
        const qg = await guardCustomerOrderNumberNotInCompleteOrdersQueue(oid);
        if (!qg.ok) {
          return qg;
        }
      }
    }

    const payload: Database["public"]["Tables"]["supplier_daily_sheets"]["Insert"] = {
      list_date: listDate,
      ready_for_processing: ready,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("supplier_daily_sheets").upsert(payload, { onConflict: "list_date" });

    if (error) {
      return { ok: false, error: supplierOrderLinesMutationErrorMessage(error) };
    }

    const nowIso = new Date().toISOString();
    if (ready) {
      const listPayload: Database["public"]["Tables"]["click_up_sheet_list"]["Insert"] = {
        list_date: listDate,
        created_at: nowIso,
      };
      const { error: listErr } = await supabase
        .from("click_up_sheet_list")
        .upsert(listPayload, { onConflict: "list_date" });
      if (listErr) {
        if (classifySupplierOrderLinesError(listErr) !== "missing_click_up_sheet_list_table") {
          await supabase
            .from("supplier_daily_sheets")
            .update({ ready_for_processing: false, updated_at: nowIso })
            .eq("list_date", listDate);
          return { ok: false, error: supplierOrderLinesMutationErrorMessage(listErr) };
        }
        // Table missing or PostgREST cache stale: keep Ready=true; list sync is best-effort.
      }
    } else {
      const { error: delErr } = await supabase.from("click_up_sheet_list").delete().eq("list_date", listDate);
      if (delErr && classifySupplierOrderLinesError(delErr) !== "missing_click_up_sheet_list_table") {
        return { ok: false, error: supplierOrderLinesMutationErrorMessage(delErr) };
      }
    }

    revalidatePath("/admin/supplier-orders");
    revalidatePath("/admin/work-process");
    revalidatePath("/admin/click-up-sheet");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    return { ok: false, error: msg };
  }
}

export async function deleteSupplierOrderLine(id: string): Promise<SupplierOrderMutationResult> {
  const auth = await assertAdmin();
  if (!auth.ok) return auth;

  const uuid = id.trim();
  if (!uuid) return { ok: false, error: "Invalid id" };

  try {
    const supabase = createSupabaseAdminClient();
    const { data: prior, error: priorErr } = await supabase
      .from("supplier_order_lines")
      .select("customer_order_id")
      .eq("id", uuid)
      .maybeSingle();
    if (priorErr || !prior) {
      return { ok: false, error: "Line not found." };
    }
    const oid = (prior.customer_order_id ?? "").trim();
    if (oid) {
      const qg = await guardCustomerOrderNumberNotInCompleteOrdersQueue(oid);
      if (!qg.ok) {
        return qg;
      }
    }

    const { error } = await supabase.from("supplier_order_lines").delete().eq("id", uuid);

    if (error) {
      return { ok: false, error: supplierOrderLinesMutationErrorMessage(error) };
    }

    revalidatePath("/admin/supplier-orders");
    revalidatePath("/admin/reports");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Delete failed";
    return { ok: false, error: msg };
  }
}
