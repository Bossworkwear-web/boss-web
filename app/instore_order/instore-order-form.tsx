"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import { createInstoreWalkInOrder } from "@/app/instore_order/actions";
import { InstoreOrderLineImageDropzone } from "@/app/instore_order/instore-order-line-image-dropzone";
import {
  InstoreOrderPrintPreview,
  type InstoreOrderPrintSnapshot,
} from "@/app/instore_order/instore-order-print-preview";
import {
  INSTORE_WALK_IN_CASH_SALE_DISCOUNT_RATE,
  INSTORE_WALK_IN_LOCATIONS,
  INSTORE_WALK_IN_LOGO_SETUP_FEE_AUD,
  INSTORE_WALK_IN_PICKUP_ADDRESS,
  INSTORE_WALK_IN_SERVICE_TYPES,
} from "@/lib/instore-walk-in-constants";
import {
  instoreDiscountPercentLabel,
  instoreEffectiveUnitAud,
  instoreLineSubtotalAud,
  instoreMinQtyForWorkItem,
  instoreQtyDiscountRate,
  instoreWorkItemLabel,
  instoreWorkItemOptionsForService,
  isInstoreWorkItemKey,
  parseInstoreLineQty,
  parseInstoreLineUnitAud,
  type InstoreWorkItemKey,
} from "@/lib/instore-order-line-pricing";

type LineDraft = {
  description: string;
  service: string;
  workItemId: string;
  imageUrls: string[];
  location: string;
  color: string;
  size: string;
  qty: string;
  unitAud: string;
  notes: string;
};

function emptyLine(): LineDraft {
  return {
    description: "",
    service: "Embroidery",
    workItemId: "",
    imageUrls: [],
    location: "",
    color: "",
    size: "",
    qty: "1",
    unitAud: "",
    notes: "",
  };
}

function lineSubtotalAud(line: LineDraft): number {
  return instoreLineSubtotalAud(line.workItemId, line.unitAud, line.qty);
}

const inputClass =
  "w-full rounded-lg border border-brand-navy/20 px-3 py-2 text-sm text-brand-navy focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange";

const boxFieldGridClass = "grid items-stretch gap-3 sm:grid-cols-3 sm:gap-4";
const boxFieldFullClass = "sm:col-span-3";

/** Size codes like M, 2XL, 10 — letters + digits; digit keys work even with Korean IME active. */
function SizeAlphanumericInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className: string;
}) {
  const composingRef = useRef(false);

  function insertAtCursor(el: HTMLInputElement, text: string) {
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    const pos = start + text.length;
    requestAnimationFrame(() => {
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <input
      type="text"
      inputMode="text"
      autoComplete="off"
      autoCapitalize="characters"
      spellCheck={false}
      value={value}
      placeholder="e.g. M, 2XL, 10"
      className={className}
      onCompositionStart={() => {
        composingRef.current = true;
      }}
      onCompositionEnd={(e) => {
        composingRef.current = false;
        onChange(e.currentTarget.value);
      }}
      onKeyDown={(e) => {
        if (composingRef.current || e.nativeEvent.isComposing) return;
        if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
        if (!/[0-9]/.test(e.key)) return;
        e.preventDefault();
        insertAtCursor(e.currentTarget, e.key);
      }}
      onChange={(e) => {
        if (composingRef.current) return;
        onChange(e.target.value);
      }}
    />
  );
}

type InstoreOrderFormProps = {
  savedOrderNumber?: string;
};

export function InstoreOrderForm({ savedOrderNumber }: InstoreOrderFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [printPreview, setPrintPreview] = useState<InstoreOrderPrintSnapshot | null>(null);
  const [pending, startTransition] = useTransition();
  const [lines, setLines] = useState<LineDraft[]>([emptyLine()]);
  const [pickup, setPickup] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [cashSale, setCashSale] = useState(false);
  const [logoSetup, setLogoSetup] = useState(false);

  const lineCount = lines.length;

  function updateLine(index: number, patch: Partial<LineDraft>) {
    setLines((prev) =>
      prev.map((row, i) => {
        if (i !== index) {
          return row;
        }
        const next = { ...row, ...patch };
        if (patch.service !== undefined && patch.service !== row.service) {
          const options = instoreWorkItemOptionsForService(patch.service);
          if (!options.some((o) => o.value === next.workItemId)) {
            next.workItemId = "";
            if (!patch.unitAud) {
              next.unitAud = "";
            }
          }
        }
        return next;
      }),
    );
  }

  function onWorkItemChange(index: number, raw: string) {
    const line = lines[index];
    if (!raw) {
      updateLine(index, { workItemId: "" });
      return;
    }
    if (!isInstoreWorkItemKey(raw)) {
      return;
    }
    const key = raw as InstoreWorkItemKey;
    const options = instoreWorkItemOptionsForService(line.service);
    const option = options.find((o) => o.value === key);
    if (!option) {
      return;
    }
    const minQty = instoreMinQtyForWorkItem(key);
    const qtyNum = parseInstoreLineQty(line.qty);
    const qty = qtyNum >= minQty ? String(qtyNum) : String(minQty);
    const unitStr = option.defaultUnitPrice.toFixed(2);
    const patch: Partial<LineDraft> = {
      workItemId: key,
      unitAud: unitStr,
      qty,
    };
    if (!line.description.trim()) {
      patch.description = option.label;
    }
    updateLine(index, patch);
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  function removeLine(index: number) {
    setLines((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));
  }

  const estimatedTotalAud = useMemo(
    () => lines.reduce((sum, line) => sum + lineSubtotalAud(line), 0),
    [lines],
  );

  const linesSubtotalAud = estimatedTotalAud;

  const linesAfterCashAud = useMemo(() => {
    const cents = Math.round(linesSubtotalAud * 100);
    if (!cashSale || cents <= 0) {
      return linesSubtotalAud;
    }
    return Math.round(cents * (1 - INSTORE_WALK_IN_CASH_SALE_DISCOUNT_RATE)) / 100;
  }, [linesSubtotalAud, cashSale]);

  const displayTotalAud = useMemo(
    () => linesAfterCashAud + (logoSetup ? INSTORE_WALK_IN_LOGO_SETUP_FEE_AUD : 0),
    [linesAfterCashAud, logoSetup],
  );

  const totalBeforeCashAud = useMemo(
    () => linesSubtotalAud + (logoSetup ? INSTORE_WALK_IN_LOGO_SETUP_FEE_AUD : 0),
    [linesSubtotalAud, logoSetup],
  );

  function openPrintPreview() {
    const form = formRef.current;
    if (!form) return;
    const fd = new FormData(form);
    const snapshot: InstoreOrderPrintSnapshot = {
      savedOrderNumber,
      printedAt: new Date().toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" }),
      customerName: String(fd.get("customer_name") ?? ""),
      customerPhone: String(fd.get("customer_phone") ?? ""),
      dueDate: String(fd.get("due_date") ?? ""),
      displayTotalAud,
      estimatedTotalAud: linesSubtotalAud,
      totalBeforeCashAud,
      cashSale,
      logoSetup,
      lines: lines.map((line) => ({ ...line })),
      pickup,
      deliveryAddress,
      orderNotes: String(fd.get("order_notes") ?? ""),
    };
    setPrintPreview(snapshot);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    fd.set("line_count", String(lineCount));
    fd.set("fulfilment", pickup ? "pickup" : "delivery");
    fd.set("cash_sale", cashSale ? "1" : "0");
    fd.set("logo_setup", logoSetup ? "1" : "0");
    if (!pickup) {
      fd.set("delivery_address", deliveryAddress);
    }
    lines.forEach((line, i) => {
      fd.set(`line_${i}_description`, line.description);
      fd.set(`line_${i}_service`, line.service);
      fd.set(`line_${i}_work_item`, line.workItemId);
      const qty = parseInstoreLineQty(line.qty);
      const unit = parseInstoreLineUnitAud(line.unitAud);
      const unitToSave =
        isInstoreWorkItemKey(line.workItemId) && qty > 0
          ? instoreEffectiveUnitAud(line.workItemId, unit, qty).toFixed(2)
          : line.unitAud;
      fd.set(`line_${i}_location`, line.location);
      fd.set(`line_${i}_color`, line.color);
      fd.set(`line_${i}_size`, line.size);
      fd.set(`line_${i}_qty`, line.qty);
      fd.set(`line_${i}_unit_aud`, unitToSave);
      const workNote =
        isInstoreWorkItemKey(line.workItemId) && qty > 0
          ? `Work item: ${instoreWorkItemLabel(line.workItemId)} (list $${unit.toFixed(2)} ea, qty ${qty})`
          : "";
      const textNotes = [workNote, line.notes.trim()].filter(Boolean).join("\n");
      fd.set(`line_${i}_notes`, textNotes);
      fd.set(`line_${i}_image_urls`, JSON.stringify(line.imageUrls));
    });
    startTransition(async () => {
      await createInstoreWalkInOrder(fd);
    });
  }

  return (
    <>
      {printPreview ? (
        <InstoreOrderPrintPreview snapshot={printPreview} onClose={() => setPrintPreview(null)} />
      ) : null}

      <form ref={formRef} id="instore-order-form" onSubmit={onSubmit} className="space-y-8">
      <section className="rounded-2xl border border-brand-navy/10 bg-white p-6 shadow-sm print:rounded-none print:border-brand-navy/25 print:p-4 print:shadow-none">
        <h2 className="text-lg font-semibold text-brand-navy">Customer</h2>
        <p className="mt-1 text-sm text-brand-navy/65 print:hidden">
          Walk-in customer details. Phone is required for the order record.
        </p>
        <div className={`mt-4 ${boxFieldGridClass}`}>
          <label className="block">
            <span className="text-sm font-semibold text-brand-navy">Name *</span>
            <input name="customer_name" required className={`${inputClass} mt-1`} autoComplete="name" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-brand-navy">Phone *</span>
            <input name="customer_phone" type="tel" required className={`${inputClass} mt-1`} autoComplete="tel" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold text-brand-navy">Due date (optional)</span>
            <input name="due_date" type="date" className={`${inputClass} mt-1`} />
          </label>
          <div className="flex min-h-0 flex-col">
            <span className="text-sm font-semibold text-brand-navy">Logo Set-up</span>
            <div className="mt-1 flex flex-1 items-stretch">
              <button
                type="button"
                onClick={() => setLogoSetup((on) => !on)}
                className={`flex w-full items-center justify-center self-stretch rounded-lg border px-4 py-2 text-sm font-semibold transition print:hidden ${
                  logoSetup
                    ? "border-brand-navy bg-brand-navy text-white hover:bg-brand-navy/90"
                    : "border-brand-orange bg-brand-orange text-brand-navy hover:brightness-95"
                }`}
              >
                Logo Set-up (+${INSTORE_WALK_IN_LOGO_SETUP_FEE_AUD})
              </button>
            </div>
          </div>
          <div className="flex min-h-0 flex-col sm:col-span-2">
            <span className="text-sm font-semibold text-brand-navy">Total amount</span>
            <div className="mt-1 flex flex-1 items-stretch gap-2">
              <div
                className={`${inputClass} flex min-w-[10rem] flex-1 items-center bg-brand-surface/60 font-semibold tabular-nums text-brand-navy`}
                aria-live="polite"
              >
                {cashSale && linesSubtotalAud > 0 ? (
                  <span className="mr-2 font-normal text-brand-navy/45 line-through">
                    ${totalBeforeCashAud.toFixed(2)}
                  </span>
                ) : null}
                ${displayTotalAud.toFixed(2)} AUD
              </div>
              <button
                type="button"
                onClick={() => setCashSale((on) => !on)}
                disabled={linesSubtotalAud <= 0}
                className={`flex shrink-0 items-center justify-center self-stretch rounded-lg border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 print:hidden ${
                  cashSale
                    ? "border-brand-orange bg-brand-orange text-brand-navy"
                    : "border-brand-navy/20 bg-white text-brand-navy hover:border-brand-orange hover:bg-brand-surface/80"
                }`}
              >
                Cash sale
              </button>
            </div>
          </div>
          {logoSetup ? (
            <p className={`text-xs font-medium text-brand-navy print:hidden ${boxFieldFullClass}`}>
              +$66.00 logo set-up added to total
            </p>
          ) : null}
          <p className={`text-xs text-brand-navy/55 print:hidden ${boxFieldFullClass}`}>
            {cashSale
              ? `${Math.round(INSTORE_WALK_IN_CASH_SALE_DISCOUNT_RATE * 100)}% cash sale on garment lines${logoSetup ? "; logo set-up not discounted" : ""}.`
              : logoSetup
                ? "Garment lines plus logo set-up fee."
                : "Updates automatically from garment line prices below."}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-6 shadow-sm print:rounded-none print:border-brand-navy/25 print:p-4 print:shadow-none">
        <h2 className="text-lg font-semibold text-brand-navy">Garments &amp; services</h2>
        <p className="mt-1 text-sm text-brand-navy/65 print:hidden">
          One row per item the customer brought in (polo, cap, jacket, etc.) and the printing or embroidery work required.
        </p>
        <div className="mt-4 space-y-6">
          {lines.map((line, index) => (
            <div
              key={index}
              className="rounded-xl border border-brand-navy/10 bg-brand-surface/30 p-4"
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-brand-navy">Item {index + 1}</p>
                {lines.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeLine(index)}
                    className="text-xs font-semibold text-red-700 hover:underline print:hidden"
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className={boxFieldGridClass}>
                <div className={`block ${boxFieldFullClass}`}>
                  <span className="text-xs font-semibold text-brand-navy/80">Images</span>
                  <div className="mt-1">
                    <InstoreOrderLineImageDropzone
                      imageUrls={line.imageUrls}
                      onImageUrlsChange={(imageUrls) => updateLine(index, { imageUrls })}
                    />
                  </div>
                </div>
                <label className={`block ${boxFieldFullClass}`}>
                  <span className="text-xs font-semibold text-brand-navy/80">Description *</span>
                  <input
                    value={line.description}
                    onChange={(e) => updateLine(index, { description: e.target.value })}
                    placeholder="e.g. Customer navy polo — logo left chest"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-brand-navy/80">Service</span>
                  <select
                    value={line.service}
                    onChange={(e) => updateLine(index, { service: e.target.value })}
                    className={`${inputClass} mt-1`}
                  >
                    {INSTORE_WALK_IN_SERVICE_TYPES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-brand-navy/80">Item</span>
                  <select
                    value={line.workItemId}
                    onChange={(e) => onWorkItemChange(index, e.target.value)}
                    className={`${inputClass} mt-1`}
                  >
                    <option value="">Select item…</option>
                    {line.service === "Embroidery & Printing" ? (
                      <>
                        <optgroup label="Embroidery">
                          {instoreWorkItemOptionsForService("Embroidery").map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label} — ${opt.defaultUnitPrice.toFixed(2)} ea
                            </option>
                          ))}
                        </optgroup>
                        <optgroup label="Printing">
                          {instoreWorkItemOptionsForService("Printing").map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label} — ${opt.defaultUnitPrice.toFixed(2)} ea (min {opt.minQty})
                            </option>
                          ))}
                        </optgroup>
                      </>
                    ) : (
                      instoreWorkItemOptionsForService(line.service).map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label} — ${opt.defaultUnitPrice.toFixed(2)} ea
                          {opt.minQty > 1 ? ` (min ${opt.minQty})` : ""}
                        </option>
                      ))
                    )}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-brand-navy/80">Location</span>
                  <select
                    value={line.location}
                    onChange={(e) => updateLine(index, { location: e.target.value })}
                    className={`${inputClass} mt-1`}
                  >
                    <option value="">Select location…</option>
                    {INSTORE_WALK_IN_LOCATIONS.map((loc) => (
                      <option key={loc} value={loc}>
                        {loc}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-brand-navy/80">Colour</span>
                  <input
                    value={line.color}
                    onChange={(e) => updateLine(index, { color: e.target.value })}
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-brand-navy/80">Size</span>
                  <SizeAlphanumericInput
                    value={line.size}
                    onChange={(size) => updateLine(index, { size })}
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-brand-navy/80">Qty</span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={line.qty}
                    onChange={(e) => updateLine(index, { qty: e.target.value })}
                    lang="en"
                    inputMode="numeric"
                    autoComplete="off"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold text-brand-navy/80">Price each (AUD)</span>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={line.unitAud}
                    onChange={(e) => updateLine(index, { unitAud: e.target.value })}
                    lang="en"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0.00"
                    className={`${inputClass} mt-1`}
                  />
                  {isInstoreWorkItemKey(line.workItemId) && parseInstoreLineQty(line.qty) > 0 ? (
                    <p className="mt-1 text-xs text-brand-navy/65 print:hidden">
                      Line total{" "}
                      <span className="font-semibold tabular-nums text-brand-navy">
                        ${lineSubtotalAud(line).toFixed(2)}
                      </span>
                      {(() => {
                        const qty = parseInstoreLineQty(line.qty);
                        const rate = instoreQtyDiscountRate(line.workItemId, qty);
                        const label = instoreDiscountPercentLabel(rate);
                        return label ? (
                          <span className="text-brand-orange"> · {label}</span>
                        ) : null;
                      })()}
                      {parseInstoreLineQty(line.qty) <
                      instoreMinQtyForWorkItem(line.workItemId) ? (
                        <span className="text-red-700">
                          {" "}
                          · Min qty {instoreMinQtyForWorkItem(line.workItemId)} for this item
                        </span>
                      ) : null}
                    </p>
                  ) : null}
                </label>
                <label className={`block sm:col-span-2`}>
                  <span className="text-xs font-semibold text-brand-navy/80">Work notes</span>
                  <input
                    value={line.notes}
                    onChange={(e) => updateLine(index, { notes: e.target.value })}
                    placeholder="Logo file, placement, thread colours…"
                    className={`${inputClass} mt-1`}
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addLine}
          className="mt-4 rounded-lg border border-brand-navy/20 px-4 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-surface/80 print:hidden"
        >
          + Add another item
        </button>
      </section>

      <section className="rounded-2xl border border-brand-navy/10 bg-white p-6 shadow-sm print:rounded-none print:border-brand-navy/25 print:p-4 print:shadow-none">
        <h2 className="text-lg font-semibold text-brand-navy">Collection</h2>
        <div className={`mt-4 ${boxFieldGridClass}`}>
          <div className={boxFieldFullClass}>
            <div className="space-y-3">
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="fulfilment_choice"
                  checked={pickup}
                  onChange={() => setPickup(true)}
                  className="mt-1"
                />
                <span>
                  <span className="font-semibold text-brand-navy">Pick up in store</span>
                  <span className="mt-0.5 block text-xs text-brand-navy/60">{INSTORE_WALK_IN_PICKUP_ADDRESS}</span>
                </span>
              </label>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="radio"
                  name="fulfilment_choice"
                  checked={!pickup}
                  onChange={() => setPickup(false)}
                  className="mt-1"
                />
                <span className="font-semibold text-brand-navy">Deliver / ship later</span>
              </label>
            </div>
          </div>
          {!pickup ? (
            <label className={`block sm:col-span-2`}>
              <span className="text-xs font-semibold text-brand-navy/80">Delivery address</span>
              <textarea
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
                rows={3}
                className={`${inputClass} mt-1`}
                placeholder="Customer delivery address"
              />
            </label>
          ) : null}
          <label className={pickup ? `${boxFieldFullClass} block` : "block sm:col-span-3"}>
            <span className="text-sm font-semibold text-brand-navy">Order notes (optional)</span>
            <textarea name="order_notes" rows={2} className={`${inputClass} mt-1`} />
          </label>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row print:hidden">
        <button
          type="button"
          onClick={openPrintPreview}
          className="w-full rounded-xl border border-brand-navy/20 bg-white px-4 py-3 text-base font-semibold text-brand-navy transition hover:border-brand-orange hover:bg-brand-surface/80 sm:w-auto sm:min-w-[10rem]"
        >
          Print
        </button>
        <button
          type="submit"
          disabled={pending}
          className="w-full flex-1 rounded-xl bg-brand-orange px-4 py-3 text-base font-semibold text-brand-navy transition hover:brightness-95 disabled:opacity-50"
        >
          {pending ? "Saving…" : "Save instore order"}
        </button>
      </div>
    </form>
    </>
  );
}
