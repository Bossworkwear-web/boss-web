"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { resolveProductionOrderIdForStoreOrderNumber } from "@/app/admin/(panel)/click-up-sheet/actions";
import { assertAdminSession } from "@/lib/admin-auth";
import { guardStoreOrderNotInCompleteOrdersQueue } from "@/lib/complete-orders-queue-mutation-block";
import { appendClickUpDispatchQueueSetupHint } from "@/lib/supabase-click-up-dispatch-queue-hint";
import { appendClickUpQcQueueSetupHint } from "@/lib/supabase-click-up-qc-queue-hint";
import { createSupabaseAdminClient } from "@/lib/supabase";

function inspectionSavedPayloadIsComplete(raw: string): boolean {
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) {
      return false;
    }
    const rec = o as Record<string, unknown>;
    const completedAt = typeof rec.completedAt === "string" ? rec.completedAt.trim() : "";
    const inspectorName = typeof rec.inspectorName === "string" ? rec.inspectorName.trim() : "";
    return completedAt.length > 0 && inspectorName.length > 0;
  } catch {
    return false;
  }
}

function qualityCheckSheetRedirectUrl(
  listDate: string,
  customerOrderId: string,
  dispatchMoveError?: string,
): string {
  const q = new URLSearchParams();
  const ld = listDate.trim();
  const oid = customerOrderId.trim();
  if (ld) {
    q.set("list_date", ld);
  }
  if (oid) {
    q.set("customer_order_id", oid);
  }
  if (dispatchMoveError) {
    q.set("dispatch_move_error", dispatchMoveError);
  }
  const s = q.toString();
  return s ? `/admin/quality-check-sheet?${s}` : "/admin/quality-check-sheet";
}

/**
 * Quality Check sheet → Move to Dispatch: upsert dispatch queue, remove from QC queue, return to Quality Control list.
 */
export async function moveStoreOrderToDispatchFromQualityCheckSheet(formData: FormData): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/login");
  }

  const listDate = (formData.get("list_date") ?? "").toString().trim();
  const customerOrderId = (formData.get("customer_order_id") ?? "").toString().trim();

  if (!listDate || !customerOrderId) {
    redirect(qualityCheckSheetRedirectUrl(listDate, customerOrderId, "missing_list_date_or_order_id"));
  }

  const inspectionRaw = (formData.get("inspection_saved_json") ?? "").toString();
  if (!inspectionSavedPayloadIsComplete(inspectionRaw)) {
    redirect(qualityCheckSheetRedirectUrl(listDate, customerOrderId, "inspection_not_completed"));
  }

  const resolved = await resolveProductionOrderIdForStoreOrderNumber(customerOrderId);
  if (!resolved.ok) {
    const short = resolved.error.length > 600 ? `${resolved.error.slice(0, 600)}…` : resolved.error;
    redirect(qualityCheckSheetRedirectUrl(listDate, customerOrderId, short));
  }

  const completeGuard = await guardStoreOrderNotInCompleteOrdersQueue(resolved.productionOrderId);
  if (!completeGuard.ok) {
    const short =
      completeGuard.error.length > 600 ? `${completeGuard.error.slice(0, 600)}…` : completeGuard.error;
    redirect(qualityCheckSheetRedirectUrl(listDate, customerOrderId, short));
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("click_up_dispatch_queue").upsert(
    {
      store_order_id: resolved.productionOrderId,
      list_date: listDate,
      moved_at: new Date().toISOString(),
    },
    { onConflict: "store_order_id" },
  );

  if (error) {
    const msg = appendClickUpDispatchQueueSetupHint(error.message);
    const short = msg.length > 800 ? `${msg.slice(0, 800)}…` : msg;
    redirect(qualityCheckSheetRedirectUrl(listDate, customerOrderId, short));
  }

  const storeOrderId = resolved.productionOrderId;
  const { error: delQcErr } = await supabase.from("click_up_qc_queue").delete().eq("store_order_id", storeOrderId);

  if (delQcErr) {
    const msg = appendClickUpQcQueueSetupHint(delQcErr.message);
    const short = msg.length > 800 ? `${msg.slice(0, 800)}…` : msg;
    redirect(qualityCheckSheetRedirectUrl(listDate, customerOrderId, short));
  }

  revalidatePath("/admin/dispatch");
  revalidatePath("/admin/quality-control");
  revalidatePath("/admin/quality-check-sheet");
  redirect("/admin/quality-control");
}
