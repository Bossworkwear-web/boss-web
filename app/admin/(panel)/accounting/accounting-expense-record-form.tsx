"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";

import { createAccountingExpense } from "@/app/admin/(panel)/accounting/actions";

const inputClass =
  "mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-brand-navy shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-xl bg-brand-orange px-4 py-2 text-sm font-semibold text-brand-navy shadow-sm transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save expense"}
    </button>
  );
}

type Props = {
  defaultExpenseDate: string;
};

export function AccountingExpenseRecordForm({ defaultExpenseDate }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileLabel, setFileLabel] = useState<string>("");

  const revokePreview = useCallback(() => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
  }, []);

  useEffect(() => () => revokePreview(), [revokePreview]);

  const assignReceiptFile = useCallback(
    (file: File | null) => {
      revokePreview();
      const input = fileInputRef.current;
      if (!input) return;
      if (!file) {
        input.value = "";
        const dt = new DataTransfer();
        input.files = dt.files;
        setFileLabel("");
        return;
      }
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      setFileLabel(file.name);
      if (file.type.startsWith("image/")) {
        setPreviewUrl(URL.createObjectURL(file));
      }
    },
    [revokePreview],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const f = e.dataTransfer.files?.[0];
      if (f) assignReceiptFile(f);
    },
    [assignReceiptFile],
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  return (
    <form action={createAccountingExpense} className="mt-4 grid grid-cols-1 gap-4">
      <input
        ref={fileInputRef}
        type="file"
        name="receipt"
        accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          if (f) assignReceiptFile(f);
          else assignReceiptFile(null);
        }}
      />

      <div>
        <p className={labelClass}>Receipt photo (optional)</p>
        <div
          role="button"
          tabIndex={0}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className="mt-1 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/80 px-4 py-8 text-center transition hover:border-brand-orange/60 hover:bg-brand-orange/5"
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- blob preview before upload
            <img src={previewUrl} alt="" className="mb-3 max-h-40 w-auto max-w-full rounded-lg object-contain shadow-sm" />
          ) : (
            <p className="text-sm font-medium text-brand-navy">Drag &amp; drop a receipt image here</p>
          )}
          <p className="mt-2 text-xs text-slate-500">JPEG, PNG, GIF, or WebP · max 12MB · or click to choose a file</p>
          {fileLabel ? <p className="mt-2 text-xs font-medium text-slate-700">{fileLabel}</p> : null}
          <button
            type="button"
            className="mt-3 text-xs font-semibold text-brand-orange underline-offset-2 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              assignReceiptFile(null);
            }}
          >
            Clear photo
          </button>
        </div>
      </div>

      <div>
        <label className={labelClass} htmlFor="expense-date">
          Expense date <span className="text-red-600">*</span>
        </label>
        <input
          id="expense-date"
          name="expense_date"
          type="date"
          required
          defaultValue={defaultExpenseDate}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="expense-amount">
          Amount (AUD) <span className="text-red-600">*</span>
        </label>
        <input
          id="expense-amount"
          name="amount_aud"
          type="text"
          inputMode="decimal"
          required
          className={inputClass}
          placeholder="e.g. 125.50"
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="expense-category">
          Category
        </label>
        <input
          id="expense-category"
          name="category"
          list="accounting-expense-categories"
          className={inputClass}
          placeholder="Rent, utilities, stock…"
        />
        <datalist id="accounting-expense-categories">
          {[
            "Rent",
            "Utilities",
            "Wages",
            "Stock & supplies",
            "Shipping & freight",
            "Marketing",
            "Software & subscriptions",
            "Equipment",
            "Professional fees",
            "Other",
          ].map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </div>
      <div>
        <label className={labelClass} htmlFor="expense-vendor">
          Vendor / payee
        </label>
        <input id="expense-vendor" name="vendor" className={inputClass} placeholder="Supplier or merchant name" />
      </div>
      <div>
        <label className={labelClass} htmlFor="expense-description">
          Description <span className="text-red-600">*</span>
        </label>
        <input
          id="expense-description"
          name="description"
          required
          className={inputClass}
          placeholder="What this payment was for"
        />
      </div>
      <div>
        <label className={labelClass} htmlFor="expense-notes">
          Notes (optional)
        </label>
        <textarea id="expense-notes" name="notes" rows={2} className={inputClass} placeholder="Invoice #, Xero ref, GST note…" />
      </div>
      <div>
        <SubmitButton />
      </div>
    </form>
  );
}
