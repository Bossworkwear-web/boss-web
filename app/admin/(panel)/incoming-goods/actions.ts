"use server";

import { refresh, revalidatePath } from "next/cache";

import { assertAdminSessionForPathSegment } from "@/lib/admin-auth";
import { syncSupplierOrderLinesReceivedDateFromIncomingGoods } from "@/lib/supplier-order-line-received-from-incoming";
import { createSupabaseAdminClient } from "@/lib/supabase";

export type IncomingGoodsRowDto = {
  storeOrderId: string;
  orderNumber: string;
  orderCreatedAt: string;
  orderStatus: string;
  customerName: string;
  itemId: string;
  productName: string;
  note: string;
  qtyOrdered: number;
  color: string | null;
  size: string | null;
  serviceType: string | null;
  qtyReceived: number;
  updatedAt: string | null;
  /** `store_order_items.sort_order` — line order within the order. */
  sortOrder: number;
};

type IncomingGoodsResult =
  | { ok: true; rows: IncomingGoodsRowDto[] }
  | { ok: false; error: string; rows: IncomingGoodsRowDto[] };

type StoreOrderJoin = {
  id?: string | null;
  order_number?: string | null;
  created_at?: string | null;
  status?: string | null;
  customer_name?: string | null;
} | null;

type StoreOrderItemJoinRow = {
  id?: string | null;
  order_id?: string | null;
  product_name?: string | null;
  quantity?: number | null;
  color?: string | null;
  size?: string | null;
  service_type?: string | null;
  sort_order?: number | null;
  store_orders?: StoreOrderJoin;
};

type IncomingReceiptRow = {
  store_order_item_id?: string | null;
  received_qty?: number | null;
  updated_at?: string | null;
  note?: string | null;
};

export async function listIncomingGoodsRows(): Promise<IncomingGoodsResult> {
  try {
    await assertAdminSessionForPathSegment("/admin/incoming-goods");
  } catch {
    return { ok: false, error: "Unauthorized", rows: [] };
  }

  try {
    const supabase = createSupabaseAdminClient();

    // Default view: show items for orders that are not shipped/cancelled.
    const { data: items, error: itemsErr } = await supabase
      .from("store_order_items")
      .select(
        "id, order_id, product_name, quantity, color, size, service_type, sort_order, store_orders ( id, order_number, created_at, status, customer_name )",
      )
      .order("created_at", { referencedTable: "store_orders", ascending: false })
      .order("sort_order", { ascending: true })
      .limit(400);

    if (itemsErr) {
      return { ok: false, error: itemsErr.message, rows: [] };
    }

    const normalized = (items ?? [])
      .map((raw) => {
        const r = raw as StoreOrderItemJoinRow;
        const order = r.store_orders;
        return {
          storeOrderId: String(order?.id ?? r.order_id ?? "").trim(),
          orderNumber: String(order?.order_number ?? "").trim(),
          orderCreatedAt: String(order?.created_at ?? "").trim(),
          orderStatus: String(order?.status ?? "").trim(),
          customerName: String(order?.customer_name ?? "").trim(),
          itemId: String(r.id ?? "").trim(),
          productName: String(r.product_name ?? "").trim(),
          qtyOrdered: Number(r.quantity ?? 0) || 0,
          color: r.color != null && String(r.color).trim() !== "" ? String(r.color) : null,
          size: r.size != null && String(r.size).trim() !== "" ? String(r.size) : null,
          serviceType:
            r.service_type != null && String(r.service_type).trim() !== "" ? String(r.service_type) : null,
          sortOrder: Math.max(0, Math.floor(Number(r.sort_order) || 0)),
        };
      })
      .filter((x) => x.storeOrderId && x.orderNumber && x.itemId);

    const openOnly = normalized.filter((x) => !["shipped", "cancelled"].includes(x.orderStatus));
    const itemIds = [...new Set(openOnly.map((x) => x.itemId))];

    const { data: receipts, error: recErr } =
      itemIds.length > 0
        ? await supabase
            .from("incoming_goods_receipts")
            .select("store_order_item_id, received_qty, updated_at, note")
            .in("store_order_item_id", itemIds)
        : { data: [] as IncomingReceiptRow[], error: null };
    if (recErr) {
      return { ok: false, error: recErr.message, rows: [] };
    }

    const receiptByItemId = new Map<string, { qty: number; updatedAt: string | null; note: string }>();
    for (const raw of receipts ?? []) {
      const r = raw as IncomingReceiptRow;
      const id = String(r.store_order_item_id ?? "").trim();
      if (!id) continue;
      receiptByItemId.set(id, {
        qty: Number(r.received_qty ?? 0) || 0,
        updatedAt: r.updated_at != null && String(r.updated_at).trim() !== "" ? String(r.updated_at) : null,
        note: String(r.note ?? ""),
      });
    }

    const rows: IncomingGoodsRowDto[] = openOnly.map((x) => {
      const rec = receiptByItemId.get(x.itemId);
      return {
        ...x,
        qtyReceived: rec?.qty ?? 0,
        updatedAt: rec?.updatedAt ?? null,
        note: rec?.note ?? "",
      };
    });

    return { ok: true, rows };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Load failed";
    return { ok: false, error: msg, rows: [] };
  }
}

async function getExistingReceipt(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  itemId: string,
): Promise<{ received_qty: number; note: string } | null> {
  const { data } = await supabase
    .from("incoming_goods_receipts")
    .select("received_qty, note")
    .eq("store_order_item_id", itemId)
    .maybeSingle();
  if (!data) return null;
  const row = data as { received_qty?: number | null; note?: string | null };
  return {
    received_qty: Number(row.received_qty ?? 0) || 0,
    note: String(row.note ?? ""),
  };
}

export async function setIncomingGoodsReceivedQty(args: {
  storeOrderItemId: string;
  receivedQty: number;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminSessionForPathSegment("/admin/incoming-goods");
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const itemId = args.storeOrderItemId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return { ok: false, error: "Invalid item id." };

  const qty = Number.isFinite(args.receivedQty) ? Math.max(0, Math.floor(args.receivedQty)) : 0;

  try {
    const supabase = createSupabaseAdminClient();
    const existing = await getExistingReceipt(supabase, itemId);
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("incoming_goods_receipts")
      .upsert(
        { store_order_item_id: itemId, received_qty: qty, note: existing?.note ?? "", updated_at: nowIso },
        { onConflict: "store_order_item_id" },
      );
    if (error) return { ok: false, error: error.message };

    await syncSupplierOrderLinesReceivedDateFromIncomingGoods(supabase, itemId, qty);

    refresh();
    revalidatePath("/admin/incoming-goods");
    revalidatePath("/admin/supplier-orders");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return { ok: false, error: msg };
  }
}

export async function setIncomingGoodsNote(args: {
  storeOrderItemId: string;
  note: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await assertAdminSessionForPathSegment("/admin/incoming-goods");
  } catch {
    return { ok: false, error: "Unauthorized" };
  }

  const itemId = args.storeOrderItemId.trim();
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) return { ok: false, error: "Invalid item id." };

  const note = String(args.note ?? "").slice(0, 2000);

  try {
    const supabase = createSupabaseAdminClient();
    const existing = await getExistingReceipt(supabase, itemId);
    const nowIso = new Date().toISOString();
    const { error } = await supabase
      .from("incoming_goods_receipts")
      .upsert(
        { store_order_item_id: itemId, received_qty: existing?.received_qty ?? 0, note, updated_at: nowIso },
        { onConflict: "store_order_item_id" },
      );
    if (error) return { ok: false, error: error.message };

    refresh();
    revalidatePath("/admin/incoming-goods");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Save failed";
    return { ok: false, error: msg };
  }
}

