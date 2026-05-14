"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import { lookupQuoteProductByIdentifier, updateQuoteCustomerEmailDraft } from "../../actions";
import type { QuoteEmailProductLine } from "../../quote-email-products";
import {
  buildQuoteCustomerEmailBody,
  computeTotalCentsFromProductLines,
  DEFAULT_QUOTE_EMAIL_LEAD_TIME,
} from "@/lib/crm/quote-email-draft";

const DEFAULT_LEAD_TIME = DEFAULT_QUOTE_EMAIL_LEAD_TIME;

function emptyLine(): QuoteEmailProductLine {
  return { product_id: "", product_name: "", size: "", colour: "", price: "", quantity: "" };
}

function initialProductLines(
  saved: QuoteEmailProductLine[],
  catalogProductId: string,
  catalogProductName: string,
  catalogProductColour: string,
  catalogQuantity: string,
): QuoteEmailProductLine[] {
  if (saved.length > 0) {
    return saved.map((l) => ({
      product_id: l.product_id,
      product_name: l.product_name,
      size: l.size ?? "",
      colour: l.colour ?? "",
      price: l.price ?? "",
      quantity: l.quantity ?? "",
    }));
  }
  if (catalogProductId.trim() || catalogProductName.trim() || catalogProductColour.trim() || catalogQuantity.trim()) {
    return [
      {
        product_id: catalogProductId,
        product_name: catalogProductName,
        size: "",
        colour: catalogProductColour.trim(),
        price: "",
        quantity: catalogQuantity.trim(),
      },
    ];
  }
  return [emptyLine()];
}

type Props = {
  quoteId: string;
  contactName: string;
  customerEmail: string;
  companyName: string;
  catalogProductId: string;
  catalogProductName: string;
  catalogProductColour: string;
  catalogQuantity: string;
  savedQuoteEmailProducts: QuoteEmailProductLine[];
  savedQuoteEmailLeadTime: string | null;
  savedQuoteEmailDeliveryAddress1: string | null;
  savedQuoteEmailDeliveryAddress2: string | null;
  savedQuoteEmailDeliverySuburb: string | null;
  savedQuoteEmailDeliveryState: string | null;
  savedQuoteEmailDeliveryCountry: string | null;
  /** When set, embed customer accept page below the text preview (Quote sent + portal token). */
  customerAcceptIframeSrc?: string | null;
};

export function CustomerEmailDraftForm({
  quoteId,
  contactName,
  customerEmail,
  companyName,
  catalogProductId,
  catalogProductName,
  catalogProductColour,
  catalogQuantity,
  savedQuoteEmailProducts,
  savedQuoteEmailLeadTime,
  savedQuoteEmailDeliveryAddress1,
  savedQuoteEmailDeliveryAddress2,
  savedQuoteEmailDeliverySuburb,
  savedQuoteEmailDeliveryState,
  savedQuoteEmailDeliveryCountry,
  customerAcceptIframeSrc,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [lines, setLines] = useState<QuoteEmailProductLine[]>(() =>
    initialProductLines(
      savedQuoteEmailProducts,
      catalogProductId,
      catalogProductName,
      catalogProductColour,
      catalogQuantity,
    ),
  );

  const linesRef = useRef(lines);
  linesRef.current = lines;

  const lookupTimersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      for (const t of lookupTimersRef.current.values()) clearTimeout(t);
      lookupTimersRef.current.clear();
    };
  }, []);

  function clearProductLookupTimer(index: number) {
    const t = lookupTimersRef.current.get(index);
    if (t) clearTimeout(t);
    lookupTimersRef.current.delete(index);
  }

  function runProductIdLookup(index: number) {
    const row = linesRef.current[index];
    if (!row) return;
    const id = row.product_id.trim();
    if (!id) return;
    const canFillMore =
      !row.product_name.trim() ||
      !row.colour.trim() ||
      !row.size.trim() ||
      !row.price.trim();
    if (!canFillMore) return;

    void (async () => {
      const r = await lookupQuoteProductByIdentifier(id);
      if (!r.ok) return;
      setLines((prev) => {
        const cur = prev[index];
        if (!cur || cur.product_id.trim() !== id) return prev;
        const next = { ...cur };
        if (!next.product_name.trim()) next.product_name = r.name;
        if (!next.colour.trim()) next.colour = r.colour;
        if (!next.size.trim()) next.size = r.size;
        if (!next.price.trim()) next.price = r.price;
        return prev.map((line, i) => (i === index ? next : line));
      });
    })();
  }

  function scheduleProductIdLookup(index: number) {
    clearProductLookupTimer(index);
    const tid = setTimeout(() => {
      lookupTimersRef.current.delete(index);
      runProductIdLookup(index);
    }, 450);
    lookupTimersRef.current.set(index, tid);
  }

  const [leadTime, setLeadTime] = useState(
    () => savedQuoteEmailLeadTime?.trim() || DEFAULT_LEAD_TIME,
  );

  const [deliveryAddress1, setDeliveryAddress1] = useState(
    () => savedQuoteEmailDeliveryAddress1?.trim() ?? "",
  );
  const [deliveryAddress2, setDeliveryAddress2] = useState(
    () => savedQuoteEmailDeliveryAddress2?.trim() ?? "",
  );
  const [deliverySuburb, setDeliverySuburb] = useState(() => savedQuoteEmailDeliverySuburb?.trim() ?? "");
  const [deliveryState, setDeliveryState] = useState(() => savedQuoteEmailDeliveryState?.trim() ?? "");
  const [deliveryCountry, setDeliveryCountry] = useState(
    () => savedQuoteEmailDeliveryCountry?.trim() ?? "",
  );

  const computedTotalCents = useMemo(() => computeTotalCentsFromProductLines(lines), [lines]);
  const totalDollarsDisplay =
    computedTotalCents !== null && Number.isFinite(computedTotalCents)
      ? (computedTotalCents / 100).toFixed(2)
      : "";

  const emailBody = useMemo(
    () =>
      buildQuoteCustomerEmailBody({
        contactName,
        companyName,
        products: lines,
        totalCents: computedTotalCents,
        leadTime,
        deliveryAddress: {
          address1: deliveryAddress1,
          address2: deliveryAddress2,
          suburb: deliverySuburb,
          state: deliveryState,
          country: deliveryCountry,
        },
        totalLineOverride: null,
      }),
    [
      companyName,
      contactName,
      leadTime,
      lines,
      computedTotalCents,
      deliveryAddress1,
      deliveryAddress2,
      deliverySuburb,
      deliveryState,
      deliveryCountry,
    ],
  );

  function updateLine(index: number, patch: Partial<QuoteEmailProductLine>) {
    setLines((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  function save() {
    setMessage(null);
    setError(null);
    const cents = computedTotalCents;
    startTransition(async () => {
      const r = await updateQuoteCustomerEmailDraft(quoteId, {
        quote_email_products: lines,
        quote_email_total_cents: cents,
        quote_email_lead_time: leadTime.trim() || null,
        quote_email_delivery_address_1: deliveryAddress1.trim() || null,
        quote_email_delivery_address_2: deliveryAddress2.trim() || null,
        quote_email_delivery_suburb: deliverySuburb.trim() || null,
        quote_email_delivery_state: deliveryState.trim() || null,
        quote_email_delivery_country: deliveryCountry.trim() || null,
      });
      if (!r.ok) {
        setError(r.error ?? "Save failed");
        return;
      }
      setMessage("Saved.");
      router.refresh();
    });
  }

  async function copyBody() {
    try {
      await navigator.clipboard.writeText(emailBody);
      setMessage("Copied email draft to clipboard.");
    } catch {
      setError("Could not copy to clipboard.");
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Customer email draft</p>
      <p className="mt-1 text-xs text-slate-600">
        Add one or more products with price per unit and quantity; total amount (GST included) is the sum of price ×
        quantity per line. Set lead time below. This will be sent to{" "}
        <span className="font-medium text-slate-800">{customerEmail}</span>. Values are saved on this quote request.
        Enter a catalog product UUID or exact store slug in Product ID; when found, empty fields for product name,
        size, colour, and list price (GST-inclusive catalog retail) fill from the catalog.
      </p>

      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-700">Products</p>
          <button
            type="button"
            onClick={addLine}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-brand-navy hover:bg-slate-50"
          >
            Add product
          </button>
        </div>

        <ul className="space-y-3">
          {lines.map((line, index) => (
            <li
              key={index}
              className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Product {index + 1}
                </span>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="text-xs font-medium text-red-700 hover:underline"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <label htmlFor={`qe-product-id-${index}`} className="text-xs font-semibold text-slate-700">
                    Product ID
                  </label>
                  <input
                    id={`qe-product-id-${index}`}
                    value={line.product_id}
                    onChange={(e) => {
                      updateLine(index, { product_id: e.target.value });
                      scheduleProductIdLookup(index);
                    }}
                    onBlur={() => {
                      clearProductLookupTimer(index);
                      runProductIdLookup(index);
                    }}
                    className="rounded-md border border-slate-200 bg-white px-2 py-2 font-mono text-sm text-slate-900"
                    placeholder="Product UUID or slug"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor={`qe-product-name-${index}`} className="text-xs font-semibold text-slate-700">
                    Product name
                  </label>
                  <input
                    id={`qe-product-name-${index}`}
                    value={line.product_name}
                    onChange={(e) => updateLine(index, { product_name: e.target.value })}
                    className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
                    placeholder="As it should appear in the email"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor={`qe-size-${index}`} className="text-xs font-semibold text-slate-700">
                    Size
                  </label>
                  <input
                    id={`qe-size-${index}`}
                    value={line.size}
                    onChange={(e) => updateLine(index, { size: e.target.value })}
                    className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
                    placeholder="e.g. M, 102R, or mixed breakdown"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-1.5">
                  <label htmlFor={`qe-colour-${index}`} className="text-xs font-semibold text-slate-700">
                    Colour
                  </label>
                  <input
                    id={`qe-colour-${index}`}
                    value={line.colour}
                    onChange={(e) => updateLine(index, { colour: e.target.value })}
                    className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
                    placeholder="e.g. Navy"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <label htmlFor={`qe-price-${index}`} className="text-xs font-semibold leading-snug text-slate-700">
                    Price per unit (including Embroidery/Printing Service)
                  </label>
                  <input
                    id={`qe-price-${index}`}
                    value={line.price}
                    onChange={(e) => updateLine(index, { price: e.target.value })}
                    className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
                    placeholder="Catalog GST-inclusive unit price incl. services; edit as needed"
                    autoComplete="off"
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <label htmlFor={`qe-qty-${index}`} className="text-xs font-semibold text-slate-700">
                    Quantity
                  </label>
                  <input
                    id={`qe-qty-${index}`}
                    value={line.quantity}
                    onChange={(e) => updateLine(index, { quantity: e.target.value })}
                    className="max-w-xs rounded-md border border-slate-200 bg-white px-2 py-2 font-mono text-sm text-slate-900"
                    placeholder="e.g. 24"
                    autoComplete="off"
                  />
                </div>
              </div>
            </li>
          ))}
        </ul>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <label htmlFor="qe-total" className="text-xs font-semibold text-slate-700">
              Total amount (GST included, AUD)
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">$</span>
              <input
                id="qe-total"
                readOnly
                value={totalDollarsDisplay}
                inputMode="decimal"
                className="min-w-0 flex-1 cursor-default rounded-md border border-slate-200 bg-slate-50 px-2 py-2 font-mono text-sm text-slate-900"
                placeholder="—"
                title="Sum of (price per unit × quantity) for each product line"
                autoComplete="off"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Auto: each line (price per unit × quantity), then all lines added. Use a numeric quantity and a price that
              includes a dollar amount (e.g. $29.99).
            </p>
          </div>
          <div className="grid gap-1.5 sm:col-span-2 sm:grid-cols-1">
            <label htmlFor="qe-lead" className="text-xs font-semibold text-slate-700">
              Expected lead time
            </label>
            <input
              id="qe-lead"
              value={leadTime}
              onChange={(e) => setLeadTime(e.target.value)}
              className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
              placeholder={DEFAULT_LEAD_TIME}
              autoComplete="off"
            />
            <p className="text-[11px] text-slate-500">Suggested default: {DEFAULT_LEAD_TIME} (dispatch).</p>
          </div>

          <div className="grid gap-3 sm:col-span-2">
            <p className="text-xs font-semibold text-slate-700">Delivery address</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5 sm:col-span-2">
                <label htmlFor="qe-delivery-addr1" className="text-xs font-semibold text-slate-700">
                  Address 1
                </label>
                <input
                  id="qe-delivery-addr1"
                  value={deliveryAddress1}
                  onChange={(e) => setDeliveryAddress1(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
                  placeholder="Street address"
                  autoComplete="address-line1"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <label htmlFor="qe-delivery-addr2" className="text-xs font-semibold text-slate-700">
                  Address 2
                </label>
                <input
                  id="qe-delivery-addr2"
                  value={deliveryAddress2}
                  onChange={(e) => setDeliveryAddress2(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
                  placeholder="Unit, suite, etc. (optional)"
                  autoComplete="address-line2"
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="qe-delivery-suburb" className="text-xs font-semibold text-slate-700">
                  Suburb
                </label>
                <input
                  id="qe-delivery-suburb"
                  value={deliverySuburb}
                  onChange={(e) => setDeliverySuburb(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
                  placeholder="Suburb"
                  autoComplete="address-level2"
                />
              </div>
              <div className="grid gap-1.5">
                <label htmlFor="qe-delivery-state" className="text-xs font-semibold text-slate-700">
                  State
                </label>
                <input
                  id="qe-delivery-state"
                  value={deliveryState}
                  onChange={(e) => setDeliveryState(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
                  placeholder="e.g. WA"
                  autoComplete="address-level1"
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <label htmlFor="qe-delivery-country" className="text-xs font-semibold text-slate-700">
                  Country
                </label>
                <input
                  id="qe-delivery-country"
                  value={deliveryCountry}
                  onChange={(e) => setDeliveryCountry(e.target.value)}
                  className="rounded-md border border-slate-200 bg-white px-2 py-2 text-sm text-slate-900"
                  placeholder="e.g. Australia"
                  autoComplete="country-name"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-slate-50 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save email fields"}
        </button>
        <button
          type="button"
          onClick={copyBody}
          className="rounded-lg border border-brand-orange/50 bg-brand-orange/15 px-3 py-2 text-xs font-semibold text-brand-navy hover:bg-brand-orange/25"
        >
          Copy email draft
        </button>
      </div>

      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
          {message}
        </p>
      ) : null}

      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Preview</p>
        <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 font-sans text-xs leading-relaxed text-slate-800">
          {emailBody}
        </pre>
        {customerAcceptIframeSrc ? (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <p className="text-xs font-semibold text-slate-700">Customer view (fill blanks and accept)</p>
            <p className="mt-1 text-[11px] text-slate-500">
              Same page customers open from the acceptance link. They complete empty fields and press Accept Quote;
              data syncs to CRM and the deal moves to Approval.
            </p>
            <iframe
              title="Customer quote accept"
              src={customerAcceptIframeSrc}
              className="mt-3 h-[min(32rem,70vh)] w-full rounded-md border border-slate-200 bg-slate-50"
              sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
            />
          </div>
        ) : null}
      </div>
    </section>
  );
}
