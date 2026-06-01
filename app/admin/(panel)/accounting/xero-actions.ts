"use server";

import { redirect } from "next/navigation";

import { assertAdminSession } from "@/lib/admin-auth";
import { resyncFailedXeroOrders } from "@/lib/xero/resync-failed-orders";

/** Admin button: re-push paid orders that never reached Xero (no xero_invoice_id). */
export async function resyncFailedXeroOrdersAction(): Promise<void> {
  try {
    await assertAdminSession();
  } catch {
    redirect("/admin/accounting?xero_error=Unauthorized");
  }

  const result = await resyncFailedXeroOrders({ maxOrders: 100 });

  if (result.attempted === 0) {
    redirect("/admin/accounting?xero=resync_none");
  }

  if (result.connectionBlocked && result.succeeded === 0) {
    const reason = result.errors[0]?.error ?? "Xero connection is not working.";
    redirect(`/admin/accounting?xero_error=${encodeURIComponent(`Resync blocked: ${reason}`)}`);
  }

  redirect(
    `/admin/accounting?xero=resynced&n=${result.succeeded}&f=${result.failed + result.skipped}`,
  );
}
