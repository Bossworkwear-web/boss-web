"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { deleteStoreOrder } from "@/app/admin/(panel)/store-orders/actions";

export function DeleteStoreOrderButton({
  orderId,
  orderNumber,
}: {
  orderId: string;
  orderNumber: string;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          const ok = window.confirm(
            `Delete order ${orderNumber}? This removes the order, line items, supplier sheet rows for this ID, ` +
              "Click up sheet uploads for this order, and production pack files linked to this order (database + storage). " +
              "The customer will no longer see it on My account, and tracking links will stop working.",
          );
          if (!ok) return;
          setMessage(null);
          startTransition(async () => {
            const res = await deleteStoreOrder(orderId);
            if (res.ok) {
              router.refresh();
              return;
            }
            setMessage(res.error);
          });
        }}
        className="inline-flex w-fit rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-900 transition hover:bg-rose-100 disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {message ? <p className="max-w-[14rem] text-xs text-rose-700">{message}</p> : null}
    </div>
  );
}
