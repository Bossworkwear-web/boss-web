"use client";

import { useRouter } from "next/navigation";

import { ArrowLeftIcon } from "@/app/components/icons";

/** Uses browser history (same as “previous page” in the tab). */
export function QuoteBackNav() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="inline-flex w-fit items-center gap-1.5 rounded-md text-left text-sm font-semibold text-brand-orange transition hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-orange"
    >
      <ArrowLeftIcon className="h-4 w-4 shrink-0" />
      Back to products
    </button>
  );
}
