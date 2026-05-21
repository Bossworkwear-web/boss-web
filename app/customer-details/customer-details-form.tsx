"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";

type CustomerDetailsFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  cancelHref: string;
  children: ReactNode;
};

function SavingOverlay() {
  const { pending } = useFormStatus();
  if (!pending) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-5 sm:p-8"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-labelledby="customer-details-saving-title"
      aria-live="polite"
    >
      <div className="w-full max-w-sm rounded-3xl border border-brand-navy/10 bg-white px-8 py-8 text-center shadow-2xl sm:max-w-md sm:px-10 sm:py-10">
        <p id="customer-details-saving-title" className="text-xl font-semibold text-brand-navy sm:text-2xl">
          Saving...
        </p>
        <p className="mt-3 text-sm text-brand-navy/65">Please wait while we save your details.</p>
      </div>
    </div>
  );
}

function SaveCustomerDetailsButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="w-fit rounded-xl bg-brand-orange px-6 py-2.5 text-sm font-medium text-brand-navy transition hover:brightness-95 disabled:cursor-wait disabled:opacity-80"
    >
      Save Customer Details
    </button>
  );
}

export function CustomerDetailsForm({ action, cancelHref, children }: CustomerDetailsFormProps) {
  return (
    <form action={action} className="grid gap-5 rounded-2xl border border-brand-navy/15 p-6">
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <SaveCustomerDetailsButton />
        <Link
          href={cancelHref}
          className="w-fit rounded-xl bg-brand-surface px-6 py-2.5 text-sm font-medium text-brand-navy transition hover:text-brand-orange"
        >
          Cancel
        </Link>
      </div>
      <SavingOverlay />
    </form>
  );
}
