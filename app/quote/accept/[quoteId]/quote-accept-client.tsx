"use client";

import { useMemo, useState, useTransition } from "react";

import type { QuoteEmailProductLine } from "@/app/admin/(panel)/crm/quote-email-products";
import { mergeProductLinesWithCustomer } from "@/lib/crm/quote-customer-accept-merge";
import type { QuoteAcceptCustomerPayload } from "@/lib/crm/quote-customer-accept-types";
import { canCustomerAcceptQuote, getCustomerAcceptValidationError } from "@/lib/crm/quote-customer-accept-validation";
import { buildQuoteCustomerEmailBody, computeTotalCentsFromProductLines } from "@/lib/crm/quote-email-draft";
import { MainWithSupplierRail } from "@/app/components/supplier-ad-banner";
import { SITE_PAGE_INNER_SHELL_CLASS } from "@/lib/site-layout";

import { submitQuoteCustomerAcceptance } from "../actions";

type Delivery = {
  address_1: string;
  address_2: string;
  suburb: string;
  state: string;
  country: string;
};

type Props = {
  embed?: boolean;
  quoteId: string;
  token: string;
  companyName: string;
  contactName: string;
  staffProductLines: QuoteEmailProductLine[];
  staffDelivery: Delivery;
  leadTimeDisplay: string;
  alreadyAccepted: boolean;
  acceptedSummary?: string | null;
};

const PRODUCT_FIELDS: { key: keyof QuoteEmailProductLine; label: string }[] = [
  { key: "product_id", label: "Product ID" },
  { key: "product_name", label: "Product name" },
  { key: "size", label: "Size" },
  { key: "colour", label: "Colour" },
  { key: "price", label: "Price per unit (incl. services)" },
  { key: "quantity", label: "Quantity" },
];

function cloneLines(lines: QuoteEmailProductLine[]): QuoteEmailProductLine[] {
  return lines.map((l) => ({ ...l }));
}

function pickDisplay(staff: string, draft: string): string {
  return staff.trim() ? staff.trim() : draft.trim();
}

function customerPayload(
  draftProducts: QuoteEmailProductLine[],
  draftDelivery: Delivery,
): QuoteAcceptCustomerPayload {
  return {
    product_lines: draftProducts,
    delivery_address_1: draftDelivery.address_1,
    delivery_address_2: draftDelivery.address_2,
    delivery_suburb: draftDelivery.suburb,
    delivery_state: draftDelivery.state,
    delivery_country: draftDelivery.country,
  };
}

export function QuoteAcceptClient({
  embed,
  quoteId,
  token,
  companyName,
  contactName,
  staffProductLines,
  staffDelivery,
  leadTimeDisplay,
  alreadyAccepted,
  acceptedSummary,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submittedComment, setSubmittedComment] = useState<string | null>(null);

  const [draftProducts, setDraftProducts] = useState(() => cloneLines(staffProductLines));
  const [draftDelivery, setDraftDelivery] = useState<Delivery>({
    address_1: staffDelivery.address_1.trim(),
    address_2: staffDelivery.address_2.trim(),
    suburb: staffDelivery.suburb.trim(),
    state: staffDelivery.state.trim(),
    country: staffDelivery.country.trim(),
  });
  const [comment, setComment] = useState("");

  const customer = useMemo(
    () => customerPayload(draftProducts, draftDelivery),
    [draftProducts, draftDelivery],
  );

  const canAccept = useMemo(
    () => canCustomerAcceptQuote(staffProductLines, draftProducts, staffDelivery, customer, comment),
    [staffProductLines, draftProducts, staffDelivery, customer, comment],
  );

  const blockingHint = useMemo(
    () => getCustomerAcceptValidationError(staffProductLines, draftProducts, staffDelivery, customer, { comment }),
    [staffProductLines, draftProducts, staffDelivery, customer, comment],
  );

  const mergedProducts = useMemo(
    () => mergeProductLinesWithCustomer(staffProductLines, draftProducts),
    [staffProductLines, draftProducts],
  );

  const mergedDelivery = useMemo(
    () => ({
      address1: pickDisplay(staffDelivery.address_1, draftDelivery.address_1),
      address2: pickDisplay(staffDelivery.address_2, draftDelivery.address_2),
      suburb: pickDisplay(staffDelivery.suburb, draftDelivery.suburb),
      state: pickDisplay(staffDelivery.state, draftDelivery.state),
      country: pickDisplay(staffDelivery.country, draftDelivery.country),
    }),
    [staffDelivery, draftDelivery],
  );

  const totalCents = useMemo(() => computeTotalCentsFromProductLines(mergedProducts), [mergedProducts]);

  const emailPreview = useMemo(
    () =>
      buildQuoteCustomerEmailBody({
        contactName,
        companyName,
        products: mergedProducts,
        totalCents,
        leadTime: leadTimeDisplay,
        deliveryAddress: mergedDelivery,
        totalLineOverride: null,
      }),
    [companyName, contactName, mergedDelivery, mergedProducts, leadTimeDisplay, totalCents],
  );

  function updateDraftLine(index: number, patch: Partial<QuoteEmailProductLine>) {
    setDraftProducts((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function accept() {
    setError(null);
    startTransition(async () => {
      const r = await submitQuoteCustomerAcceptance(quoteId, token, customer, comment);
      if (!r.ok) {
        setError(r.error ?? "Could not accept quote.");
        return;
      }
      setSubmittedComment(comment.trim());
      setDone(true);
    });
  }

  if (alreadyAccepted || done) {
    const body = done ? emailPreview : acceptedSummary ?? "";
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <MainWithSupplierRail>
          <div className={`${SITE_PAGE_INNER_SHELL_CLASS} py-10`}>
            <h1 className="text-2xl font-semibold text-brand-navy">Thank you</h1>
            <p className="mt-2 text-sm text-slate-600">
              Your quote acceptance has been recorded. Our team will follow up shortly.
            </p>
            {body ? (
              <pre className="mt-6 max-h-[28rem] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-sans text-xs leading-relaxed text-slate-800">
                {body}
              </pre>
            ) : null}
            {submittedComment ? (
              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Your comment</p>
                <pre className="mt-2 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-200 bg-white p-4 font-sans text-sm leading-relaxed text-slate-800">
                  {submittedComment}
                </pre>
              </div>
            ) : null}
          </div>
        </MainWithSupplierRail>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <MainWithSupplierRail>
        <div className={`${SITE_PAGE_INNER_SHELL_CLASS} py-8`}>
          {!embed ? (
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Quote acceptance</p>
          ) : null}
          <h1 className="mt-1 text-2xl font-semibold text-brand-navy">{companyName}</h1>
          <p className="mt-1 text-sm text-slate-600">
            Hi {contactName}, review the quote below. Fill every empty product and delivery field marked for you, add a
            comment, then accept to confirm.
          </p>

          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
            <pre className="mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-100 bg-slate-50 p-3 font-sans text-xs leading-relaxed text-slate-800">
              {emailPreview}
            </pre>

            <div className="mt-6 space-y-6 border-t border-slate-100 pt-6">
              <section>
                <p className="text-sm font-semibold text-slate-800">Required: complete empty fields</p>
                <p className="mt-1 text-xs text-slate-500">
                  Fields your sales rep already filled are shown as text. You must complete the rest before Accept is
                  enabled.
                </p>
                <ul className="mt-4 space-y-6">
                  {staffProductLines.map((staffLine, lineIndex) => (
                    <li key={lineIndex} className="rounded-lg border border-slate-200 bg-slate-50/80 p-4">
                      <p className="text-xs font-semibold text-slate-600">Product {lineIndex + 1}</p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {PRODUCT_FIELDS.map(({ key, label }) => {
                          const staffVal = staffLine[key];
                          const draftVal = draftProducts[lineIndex]?.[key] ?? "";
                          const locked = Boolean(String(staffVal).trim());
                          return (
                            <div key={key} className="grid gap-1">
                              <span className="text-xs font-semibold text-slate-700">
                                {label}
                                {!locked ? <span className="text-red-600"> *</span> : null}
                              </span>
                              {locked ? (
                                <span className="rounded-md border border-transparent bg-white px-2 py-2 text-sm text-slate-800">
                                  {String(staffVal).trim() || "—"}
                                </span>
                              ) : (
                                <input
                                  value={draftVal}
                                  onChange={(e) =>
                                    updateDraftLine(lineIndex, { [key]: e.target.value } as Partial<QuoteEmailProductLine>)
                                  }
                                  className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
                                  autoComplete="off"
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section>
                <p className="text-sm font-semibold text-slate-800">Delivery address</p>
                <p className="mt-1 text-xs text-slate-500">
                  Address 2 is optional. Address 1, suburb, state, and country are required only if they were left blank
                  on your quote.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {(
                    [
                      ["address_1", "Address 1", true],
                      ["address_2", "Address 2 (optional)", false],
                      ["suburb", "Suburb", true],
                      ["state", "State", true],
                      ["country", "Country", true],
                    ] as const
                  ).map(([key, label, requiredWhenEmpty]) => {
                    const staffVal = staffDelivery[key];
                    const locked = Boolean(staffVal.trim());
                    const val = draftDelivery[key];
                    return (
                      <div
                        key={key}
                        className={`grid gap-1 ${key === "address_1" || key === "address_2" ? "sm:col-span-2" : ""}`}
                      >
                        <span className="text-xs font-semibold text-slate-700">
                          {label}
                          {!locked && requiredWhenEmpty ? <span className="text-red-600"> *</span> : null}
                        </span>
                        {locked ? (
                          <span className="rounded-md border border-transparent bg-slate-50 px-2 py-2 text-sm text-slate-800">
                            {staffVal.trim() || "—"}
                          </span>
                        ) : (
                          <input
                            value={val}
                            onChange={(e) =>
                              setDraftDelivery((d) => ({
                                ...d,
                                [key]: e.target.value,
                              }))
                            }
                            className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
                            autoComplete="off"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>

              <section>
                <label htmlFor="quote-accept-comment" className="text-sm font-semibold text-slate-800">
                  Comment <span className="text-red-600">*</span>
                </label>
                <p className="mt-1 text-xs text-slate-500">
                  Add any notes for our team (delivery instructions, PO reference, questions, etc.).
                </p>
                <textarea
                  id="quote-accept-comment"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={4}
                  className="mt-2 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  placeholder="Enter your comment…"
                  maxLength={8000}
                />
                <p className="mt-1 text-[11px] text-slate-400">{comment.length} / 8000</p>
              </section>
            </div>

            {error ? (
              <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800" role="alert">
                {error}
              </p>
            ) : null}

            {!canAccept && !error ? (
              <p className="mt-4 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
                {blockingHint ?? "Complete all required fields and a comment to enable Accept Quote."}
              </p>
            ) : null}

            <div className="mt-8 border-t border-slate-100 pt-6">
              <button
                type="button"
                disabled={pending || !canAccept}
                onClick={accept}
                className="rounded-xl bg-brand-orange px-8 py-3 text-sm font-semibold text-brand-navy transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-45"
              >
                {pending ? "Saving…" : "Accept Quote"}
              </button>
            </div>
          </div>
        </div>
      </MainWithSupplierRail>
    </div>
  );
}
