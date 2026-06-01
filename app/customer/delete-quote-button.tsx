"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { deleteCustomerQuote } from "@/app/cart/quote-actions";

type DeleteQuoteButtonProps = {
  quoteId: string;
  quoteNumber: string;
};

export function DeleteQuoteButton({ quoteId, quoteNumber }: DeleteQuoteButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setError(null);
    const ok = window.confirm(`Delete quote ${quoteNumber}? This cannot be undone.`);
    if (!ok) {
      return;
    }
    setPending(true);
    try {
      const res = await deleteCustomerQuote(quoteId);
      if (!res.ok) {
        setError(res.error);
        setPending(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Could not delete this quote.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => void handleDelete()}
        className="text-[1.26rem] font-semibold text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "Deleting…" : "Delete"}
      </button>
      {error ? <span className="max-w-[14.5rem] text-[1.08rem] text-red-600">{error}</span> : null}
    </div>
  );
}
