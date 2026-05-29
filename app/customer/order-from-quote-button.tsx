"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { getQuoteLinesForCart } from "@/app/cart/quote-actions";
import { getCartCount, replaceCartWithLines } from "@/lib/cart";

type OrderFromQuoteButtonProps = {
  quoteId: string;
};

export function OrderFromQuoteButton({ quoteId }: OrderFromQuoteButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleOrder() {
    setError(null);
    if (getCartCount() > 0) {
      const ok = window.confirm(
        "Your cart currently has items. Replace the cart with this quote so you can edit and check out?",
      );
      if (!ok) {
        return;
      }
    }
    setPending(true);
    try {
      const res = await getQuoteLinesForCart(quoteId);
      if (!res.ok) {
        setError(res.error);
        setPending(false);
        return;
      }
      replaceCartWithLines(res.lines);
      router.push("/cart");
    } catch {
      setError("Could not load this quote.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleOrder()}
        className="text-[1.26rem] font-semibold text-brand-orange hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Loading…" : "Order"}
      </button>
      {error ? <span className="max-w-[14.5rem] text-[1.08rem] text-red-600">{error}</span> : null}
    </div>
  );
}
