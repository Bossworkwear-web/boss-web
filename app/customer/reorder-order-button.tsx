"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { getOrderLinesForReorder } from "@/app/customer/actions";
import { getCartCount, replaceCartWithLines } from "@/lib/cart";

type ReorderOrderButtonProps = {
  orderId: string;
};

export function ReorderOrderButton({ orderId }: ReorderOrderButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReorder() {
    setError(null);
    if (getCartCount() > 0) {
      const ok = window.confirm(
        "Your cart currently has items. Replace the cart with this order so you can edit and check out again?",
      );
      if (!ok) {
        return;
      }
    }
    setPending(true);
    try {
      const res = await getOrderLinesForReorder(orderId);
      if (!res.ok) {
        setError(res.error);
        setPending(false);
        return;
      }
      replaceCartWithLines(res.lines, { mockupImageUrls: res.mockupImageUrls });
      router.push("/cart");
    } catch {
      setError("Could not load this order.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleReorder()}
        className="text-[1.26rem] font-semibold text-brand-orange hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Loading…" : "Reorder"}
      </button>
      {error ? <span className="max-w-[14.5rem] text-[1.08rem] text-red-600">{error}</span> : null}
    </div>
  );
}
