"use client";

import { ClipboardIcon } from "@/app/components/icons";
import {
  QUOTE_MIN_TOTAL_QUANTITY,
  useQuoteQuantity,
} from "@/app/components/quote-quantity-context";

export function QuoteSubmitButton() {
  const { totalQuantity, canSubmit } = useQuoteQuantity();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="submit"
        disabled={!canSubmit}
        className="inline-flex w-fit items-center gap-2 rounded-xl bg-brand-orange px-6 py-3 text-sm font-medium text-brand-navy transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <ClipboardIcon className="h-4 w-4" />
        Submit Quote Request
      </button>
      {!canSubmit ? (
        <p className="text-sm text-brand-navy/65">
          Total quantity is <strong>{totalQuantity}</strong>. Enter at least{" "}
          <strong>{QUOTE_MIN_TOTAL_QUANTITY}</strong> units across all products to submit.
        </p>
      ) : null}
    </div>
  );
}
