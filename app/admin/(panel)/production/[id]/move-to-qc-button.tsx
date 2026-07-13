"use client";

import { moveStoreOrderToQualityControlFromProduction } from "@/app/admin/(panel)/quality-control/actions";
import { notifyRouteLoadingStart } from "@/lib/route-loading";

const BTN_CLASS =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50 border border-brand-orange bg-brand-orange text-brand-navy hover:brightness-95";

export function MoveToQcButton({ storeOrderId }: { storeOrderId: string }) {
  return (
    <form
      action={moveStoreOrderToQualityControlFromProduction}
      className="inline-flex"
      onSubmit={() => {
        notifyRouteLoadingStart({
          overlay: {
            title: "Moving to QC...",
            description: "Opening Quality Control.",
          },
          immediate: true,
        });
      }}
    >
      <input type="hidden" name="store_order_id" value={storeOrderId} />
      <button type="submit" className={BTN_CLASS}>
        Move to QC
      </button>
    </form>
  );
}
