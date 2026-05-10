"use client";

import { deleteQuoteRequest } from "./actions";

export function DeleteQuoteListButton({ quoteId }: { quoteId: string }) {
  return (
    <form action={deleteQuoteRequest} className="inline">
      <input type="hidden" name="quote_id" value={quoteId} />
      <button
        type="submit"
        className="inline-flex rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-900 hover:bg-red-100"
        onClick={(e) => {
          if (!confirm("Delete this quote from the list? This cannot be undone.")) {
            e.preventDefault();
          }
        }}
      >
        Delete
      </button>
    </form>
  );
}
