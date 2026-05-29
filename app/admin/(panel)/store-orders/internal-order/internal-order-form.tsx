"use client";

import { useEffect, useMemo, useState, useTransition } from "react";

import { isNextNavigationError, readResponseJson, stringifyJsonField } from "@/lib/safe-json-parse";
import { todayPerthYmd } from "@/lib/perth-calendar";

import { CustomerQuoteImageDropzone } from "@/app/admin/(panel)/customer-quote/customer-quote-image-dropzone";
import { QuoteProductAutocomplete } from "@/app/components/quote-product-autocomplete";
import { findQuoteCatalogProduct, type QuoteCatalogProduct } from "@/lib/quote-catalog-products";

import {
  createInternalOrderFromTemplate,
  saveCustomerQuoteSheet,
  type AdminCustomerQuoteSheetV1,
} from "./actions";

type Item = {
  productId: string;
  productName: string;
  /** Linked storefront catalog product UUID (drives the colour dropdown). */
  catalogProductId: string | null;
  quantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
  serviceType: string;
  color: string;
  size: string;
  placementsJson: string;
  notes: string;
  quoteGroupId: number;
  gender: string;
};

type Template = {
  baseOrderNumber: string;
  customerEmail: string;
  customerName: string;
  deliveryAddress: string;
  currency: string;
  carrier: string;
  deliveryFeeCents: number;
  quoteCompanyName?: string;
  quoteContactPhone?: string;
  customerQuoteDraft?: {
    orderDate: string;
    dueDate: string;
    setupFeeCents: number;
    quoteDeliveryFeeCents: number;
    depositCents: number;
    status: "unpaid" | "paid" | "processing" | "shipped" | "cancelled";
  };
  quoteBoxImageUrls?: string[];
  quoteBoxNote?: string;
  xeroQuoteId?: string | null;
  xeroQuoteNumber?: string | null;
  xeroQuoteSyncedAt?: string | null;
  items: Array<{
    productId: string;
    productName: string;
    catalogProductId?: string | null;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
    serviceType: string | null;
    color: string | null;
    size: string | null;
    placementsJson: string;
    notes: string | null;
    gender?: string | null;
    quoteGroupId?: number | null;
  }>;
};

function toItem(t: Template["items"][number], groupId: number): Item {
  const gid =
    typeof t.quoteGroupId === "number" && Number.isFinite(t.quoteGroupId) && t.quoteGroupId > 0
      ? t.quoteGroupId
      : groupId;
  return {
    productId: t.productId ?? "",
    productName: t.productName ?? "",
    catalogProductId: t.catalogProductId ?? null,
    quantity: typeof t.quantity === "number" ? t.quantity : 0,
    unitPriceCents: typeof t.unitPriceCents === "number" ? t.unitPriceCents : 0,
    lineTotalCents: typeof t.lineTotalCents === "number" ? t.lineTotalCents : 0,
    serviceType: t.serviceType ?? "",
    color: t.color ?? "",
    size: t.size ?? "",
    placementsJson: t.placementsJson ?? "[]",
    notes: t.notes ?? "",
    quoteGroupId: gid,
    gender: typeof t.gender === "string" ? t.gender : "",
  };
}

function nextQuoteGroupId(list: Item[]): number {
  return list.length === 0 ? 1 : Math.max(...list.map((i) => i.quoteGroupId)) + 1;
}

function emptyItemRow(groupId: number): Item {
  return {
    productId: "",
    productName: "",
    catalogProductId: null,
    quantity: 1,
    unitPriceCents: 0,
    lineTotalCents: 0,
    serviceType: "",
    color: "",
    size: "",
    placementsJson: "[]",
    notes: "",
    quoteGroupId: groupId,
    gender: "",
  };
}

function safeInt(raw: string, fallback = 0): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

/** Parse a dollar amount (e.g. "12.50") to integer cents for DB / API. */
function parseDollarsToCents(raw: string): number {
  const s = String(raw).trim().replace(/^\$/, "");
  if (!s) return 0;
  const n = Number.parseFloat(s);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function centsToDollarFieldValue(cents: number): number {
  return Math.round(Number(cents) || 0) / 100;
}

function formatAud(cents: number): string {
  return new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" }).format(
    (Number(cents) || 0) / 100,
  );
}

const inputClass =
  "mt-0.5 w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-brand-navy shadow-sm focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange";
const labelClass = "block text-xs font-semibold uppercase tracking-wide text-slate-500";

const quoteCellInput =
  "w-full min-h-[2rem] border-0 bg-transparent px-1.5 py-1 text-sm text-brand-navy placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-orange/40";
const quoteTh =
  "border-x-0 border-t-0 border-b border-slate-900 bg-slate-100 px-2 py-2 text-left text-[11px] font-bold uppercase tracking-wide text-slate-900";
const quoteTd = "border-x-0 border-t-0 border-b border-slate-900 p-0 align-middle bg-white";

/** Customer Quote toolbar (Print): ~30% larger than previous text-xs px-3 py-2. */
const customerQuoteToolbarBtn =
  "rounded-lg border border-white px-[0.975rem] py-[0.65rem] text-[0.975rem] leading-tight font-semibold shadow-sm";

export function InternalOrderForm({
  template,
  isBlankStarter,
  variant = "internal",
  quoteRequestId = null,
  quoteSubmitContext = "customer-quote",
  catalog = [],
}: {
  template: Template;
  isBlankStarter: boolean;
  variant?: "internal" | "customer-quote";
  /** Storefront catalog for the Item ID picker + colour dropdown (Customer Quote). */
  catalog?: QuoteCatalogProduct[];
  /** When set, Save Quote updates this `quote_requests` row. */
  quoteRequestId?: string | null;
  /**
   * Where quote-sheet submits return after save / which `source` value is sent for Make Store order.
   * `internal-order` → same sheet as Customer Quote but redirects stay on Internal order.
   */
  quoteSubmitContext?: "customer-quote" | "internal-order";
}) {
  const isQuote = variant === "customer-quote";
  const isInternalOrderQuote = isQuote && quoteSubmitContext === "internal-order";
  const [saveQuotePending, startSaveQuoteTransition] = useTransition();
  const [xeroQuotePending, startXeroQuoteTransition] = useTransition();
  const [saveQuoteError, setSaveQuoteError] = useState<string | null>(null);
  const [xeroQuoteError, setXeroQuoteError] = useState<string | null>(null);
  const [xeroQuoteId, setXeroQuoteId] = useState<string | null>(() => template.xeroQuoteId ?? null);
  const [xeroQuoteNumber, setXeroQuoteNumber] = useState<string | null>(() => template.xeroQuoteNumber ?? null);
  const [xeroQuoteSyncedAt, setXeroQuoteSyncedAt] = useState<string | null>(
    () => template.xeroQuoteSyncedAt ?? null,
  );
  const quoteSaveReturnBase =
    quoteSubmitContext === "internal-order" ? "/admin/instore-orders/internal-order" : "/admin/customer-quote";

  const [baseOrderNumber, setBaseOrderNumber] = useState(template.baseOrderNumber);
  const [customerEmail, setCustomerEmail] = useState(template.customerEmail);
  const [customerName, setCustomerName] = useState(template.customerName);
  const [deliveryAddress, setDeliveryAddress] = useState(template.deliveryAddress);
  const [companyName, setCompanyName] = useState(template.quoteCompanyName ?? "");
  const [clientContact, setClientContact] = useState(template.quoteContactPhone ?? "");
  const [orderDate, setOrderDate] = useState(() => todayPerthYmd());
  const [dueDate, setDueDate] = useState("");
  const [setupFeeCents, setSetupFeeCents] = useState(0);
  const [quoteDeliveryFeeCents, setQuoteDeliveryFeeCents] = useState(() =>
    variant === "customer-quote" ? (template.deliveryFeeCents ?? 0) : 0,
  );
  const [depositCents, setDepositCents] = useState(0);
  const [currency, setCurrency] = useState(template.currency || "AUD");
  const [carrier, setCarrier] = useState(template.carrier || "Australia Post");
  const [status, setStatus] = useState<"unpaid" | "paid" | "processing" | "shipped" | "cancelled">(() =>
    variant === "customer-quote" ? "unpaid" : "paid",
  );
  const [deliveryFeeCents, setDeliveryFeeCents] = useState<number>(template.deliveryFeeCents ?? 0);
  const [items, setItems] = useState<Item[]>(() =>
    template.items.map((t, idx) => toItem(t, idx + 1)),
  );
  const [activeQuoteGroupId, setActiveQuoteGroupId] = useState<number | null>(() => {
    const first = template.items[0];
    if (!first) return null;
    const gid =
      typeof first.quoteGroupId === "number" && Number.isFinite(first.quoteGroupId) && first.quoteGroupId > 0
        ? first.quoteGroupId
        : 1;
    return gid;
  });
  const [quoteBoxImageUrls, setQuoteBoxImageUrls] = useState<string[]>(() => [
    ...(template.quoteBoxImageUrls ?? []),
  ]);
  const [quoteBoxNote, setQuoteBoxNote] = useState(() => template.quoteBoxNote ?? "");
  /** Raw dollar text while editing money cells (keyed by row index) so decimals like "25.5" can be typed. */
  const [priceDrafts, setPriceDrafts] = useState<Record<number, string>>({});
  const [totalDrafts, setTotalDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    setBaseOrderNumber(template.baseOrderNumber);
    setCustomerEmail(template.customerEmail);
    setCustomerName(template.customerName);
    setDeliveryAddress(template.deliveryAddress);
    setCompanyName(template.quoteCompanyName ?? "");
    setClientContact(template.quoteContactPhone ?? "");
    setCurrency(template.currency || "AUD");
    setCarrier(template.carrier || "Australia Post");
    setDeliveryFeeCents(template.deliveryFeeCents ?? 0);
    setItems(template.items.map((t, idx) => toItem(t, idx + 1)));
    setPriceDrafts({});
    setTotalDrafts({});
    setQuoteBoxImageUrls([...(template.quoteBoxImageUrls ?? [])]);
    setQuoteBoxNote(template.quoteBoxNote ?? "");
    setXeroQuoteId(template.xeroQuoteId ?? null);
    setXeroQuoteNumber(template.xeroQuoteNumber ?? null);
    setXeroQuoteSyncedAt(template.xeroQuoteSyncedAt ?? null);
    if (template.customerQuoteDraft) {
      setOrderDate(template.customerQuoteDraft.orderDate || todayPerthYmd());
      setDueDate(template.customerQuoteDraft.dueDate);
      setSetupFeeCents(template.customerQuoteDraft.setupFeeCents);
      setQuoteDeliveryFeeCents(template.customerQuoteDraft.quoteDeliveryFeeCents);
      setDepositCents(template.customerQuoteDraft.depositCents);
      const st = template.customerQuoteDraft.status;
      setStatus(st === "paid" || st === "unpaid" ? st : "unpaid");
    } else if (variant === "customer-quote") {
      setOrderDate(todayPerthYmd());
      setDueDate("");
      setSetupFeeCents(0);
      setQuoteDeliveryFeeCents(template.deliveryFeeCents ?? 0);
      setDepositCents(0);
      setStatus("unpaid");
    }
  }, [template, variant]);

  useEffect(() => {
    if (items.length === 0) {
      setActiveQuoteGroupId(null);
      return;
    }
    setActiveQuoteGroupId((current) => {
      if (current !== null && items.some((row) => row.quoteGroupId === current)) {
        return current;
      }
      return items[items.length - 1]!.quoteGroupId;
    });
  }, [items]);

  const subtotalCents = useMemo(() => items.reduce((sum, it) => sum + (Number(it.lineTotalCents) || 0), 0), [items]);
  const totalCents = subtotalCents + (Number(deliveryFeeCents) || 0);
  const sumQty = useMemo(() => items.reduce((sum, it) => sum + (Number(it.quantity) || 0), 0), [items]);

  const quoteTaxableSubtotalCents = useMemo(
    () => subtotalCents + setupFeeCents + quoteDeliveryFeeCents,
    [subtotalCents, setupFeeCents, quoteDeliveryFeeCents],
  );
  const quoteGstCents = useMemo(
    () => Math.round(quoteTaxableSubtotalCents * 0.1),
    [quoteTaxableSubtotalCents],
  );
  const quoteTotalBalanceCents = useMemo(
    () => quoteTaxableSubtotalCents + quoteGstCents - depositCents,
    [quoteTaxableSubtotalCents, quoteGstCents, depositCents],
  );

  const quoteGroupMeta = useMemo(() => {
    const byId = new Map<number, { start: number; count: number }>();
    items.forEach((it, idx) => {
      const g = it.quoteGroupId;
      if (!byId.has(g)) byId.set(g, { start: idx, count: 0 });
      byId.get(g)!.count += 1;
    });
    return byId;
  }, [items]);

  const composedQuoteDelivery = useMemo(() => {
    const parts: string[] = [];
    if (companyName.trim()) parts.push(`Company: ${companyName.trim()}`);
    if (clientContact.trim()) parts.push(`Client contact: ${clientContact.trim()}`);
    if (orderDate) parts.push(`Order date: ${orderDate}`);
    if (dueDate) parts.push(`Due date: ${dueDate}`);
    if (parts.length) parts.push("");
    parts.push(deliveryAddress.trim());
    return parts.join("\n");
  }, [companyName, clientContact, orderDate, dueDate, deliveryAddress]);

  const itemsPayload = useMemo(() => {
    return items.map((row, idx) => {
      const g = row.quoteGroupId;
      const start = quoteGroupMeta.get(g)?.start ?? idx;
      const leader = items[start]!;
      const serviceType = row.serviceType.trim() || leader.serviceType.trim();
      const productId = row.productId.trim() || leader.productId.trim();
      const color = row.color.trim() || leader.color.trim();
      const productName =
        row.productName.trim() ||
        leader.productName.trim() ||
        productId ||
        "Quote line";
      const { quoteGroupId: _q, ...rest } = row;
      return {
        ...rest,
        serviceType,
        productId,
        color,
        productName,
      };
    });
  }, [items, quoteGroupMeta]);

  const customerQuoteSheetPayload = useMemo((): AdminCustomerQuoteSheetV1 | null => {
    if (!isQuote) return null;
    return {
      v: 1,
      baseOrderNumber,
      customerEmail,
      customerName,
      deliveryAddress,
      companyName,
      clientContact,
      orderDate,
      dueDate,
      setupFeeCents,
      quoteDeliveryFeeCents,
      depositCents,
      currency,
      carrier,
      status,
      quoteBoxImageUrls,
      quoteBoxNote,
      xeroQuoteId,
      xeroQuoteNumber,
      xeroQuoteSyncedAt,
      items: items.map((row, idx) => {
        const g = row.quoteGroupId;
        const start = quoteGroupMeta.get(g)?.start ?? idx;
        const leader = items[start]!;
        const serviceType = row.serviceType.trim() || leader.serviceType.trim();
        const productId = row.productId.trim() || leader.productId.trim();
        const color = row.color.trim() || leader.color.trim();
        const productName =
          row.productName.trim() ||
          leader.productName.trim() ||
          productId ||
          "Quote line";
        return {
          productId,
          productName,
          catalogProductId: row.catalogProductId ?? leader.catalogProductId ?? null,
          quantity: Math.max(0, Number(row.quantity) || 0),
          unitPriceCents: Math.max(0, Number(row.unitPriceCents) || 0),
          lineTotalCents: Math.max(0, Number(row.lineTotalCents) || 0),
          serviceType: serviceType ? serviceType : null,
          color: color ? color : null,
          size: row.size.trim() ? row.size.trim() : null,
          placementsJson: row.placementsJson || "[]",
          notes: row.notes.trim() ? row.notes.trim() : null,
          gender: row.gender || "",
          quoteGroupId: row.quoteGroupId,
        };
      }),
    };
  }, [
    isQuote,
    baseOrderNumber,
    customerEmail,
    customerName,
    deliveryAddress,
    companyName,
    clientContact,
    orderDate,
    dueDate,
    setupFeeCents,
    quoteDeliveryFeeCents,
    depositCents,
    currency,
    carrier,
    status,
    quoteBoxImageUrls,
    quoteBoxNote,
    xeroQuoteId,
    xeroQuoteNumber,
    xeroQuoteSyncedAt,
    items,
    quoteGroupMeta,
  ]);

  const itemsJsonField = useMemo(() => stringifyJsonField(itemsPayload, "[]"), [itemsPayload]);

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((cur) => {
      const next = [...cur];
      const prev = next[idx]!;
      const merged = { ...prev, ...patch };
      if ("quantity" in patch || "unitPriceCents" in patch) {
        const q = Math.max(0, Number(merged.quantity) || 0);
        const u = Math.max(0, Number(merged.unitPriceCents) || 0);
        merged.lineTotalCents = q * u;
      }
      next[idx] = merged;
      return next;
    });
  }

  function removeItem(idx: number) {
    setItems((cur) => {
      const copy = [...cur];
      const removed = copy[idx];
      if (!removed) return cur;
      copy.splice(idx, 1);
      const nextAt = copy[idx];
      if (nextAt && nextAt.quoteGroupId === removed.quoteGroupId) {
        copy[idx] = {
          ...nextAt,
          serviceType: nextAt.serviceType || removed.serviceType,
          productId: nextAt.productId || removed.productId,
          color: nextAt.color || removed.color,
          notes: nextAt.notes || removed.notes,
          productName: nextAt.productName || removed.productName,
        };
      }
      return copy;
    });
  }

  function addItem() {
    setItems((cur) => [...cur, emptyItemRow(nextQuoteGroupId(cur))]);
  }

  function addQuoteProductGroup() {
    const groupId = nextQuoteGroupId(items);
    setItems((cur) => [...cur, emptyItemRow(groupId)]);
    setActiveQuoteGroupId(groupId);
  }

  function insertQuoteSizeRowForGroup(groupId: number) {
    setItems((cur) => {
      if (cur.length === 0) return [emptyItemRow(groupId)];
      let insertAt = cur.length;
      for (let i = cur.length - 1; i >= 0; i -= 1) {
        if (cur[i]!.quoteGroupId === groupId) {
          insertAt = i + 1;
          break;
        }
      }
      const next = [...cur];
      next.splice(insertAt, 0, emptyItemRow(groupId));
      return next;
    });
  }

  function selectQuoteGroupForSizeRow(groupId: number) {
    setActiveQuoteGroupId(groupId);
    insertQuoteSizeRowForGroup(groupId);
  }

  if (!isQuote) {
    return (
      <div id="internal-order-form" className="space-y-8">
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-brand-navy">
            {isBlankStarter ? "Create order (no template)" : "Edit details"}
          </h2>
          {isBlankStarter ? (
            <div className="mt-2 space-y-3 text-sm text-slate-600">
              <p>
                기존 고객 프로필이 없어도 됩니다. 이메일·메시지·매장 등으로 접수한 내용을 입력한 뒤 저장하세요. 새 Customer Order ID는{" "}
                <span className="font-mono">접두어_1</span>, <span className="font-mono">접두어_2</span> … 순으로 붙습니다.
              </p>
              <div>
                <label className={labelClass}>Base Customer Order ID (optional)</label>
                <input
                  className={inputClass}
                  value={baseOrderNumber}
                  onChange={(e) => setBaseOrderNumber(e.target.value)}
                  placeholder="비우면 INT_YYYYMMDD_… 자동 생성"
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-slate-500">
                  직접 쓰면 그 문자열이 접두어입니다. 비우면 서버가 <span className="font-mono">INT_날짜_임의hex</span>를 한 번 부여합니다.
                </p>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Base Customer Order ID:{" "}
              <span className="font-mono font-semibold text-brand-navy">{baseOrderNumber}</span>
              <br />
              저장하면 새 Customer Order ID는 <span className="font-mono">{baseOrderNumber}_count</span> 형태로 생성됩니다.
            </p>
          )}
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Customer email</label>
              <input className={inputClass} value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Customer name</label>
              <input className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>Delivery address</label>
              <textarea
                className={inputClass}
                rows={4}
                value={deliveryAddress}
                onChange={(e) => setDeliveryAddress(e.target.value)}
              />
            </div>
            <div>
              <label className={labelClass}>Currency</label>
              <input className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Carrier</label>
              <input className={inputClass} value={carrier} onChange={(e) => setCarrier(e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Status</label>
              <select
                className={inputClass}
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as "unpaid" | "paid" | "processing" | "shipped" | "cancelled")
                }
              >
                <option value="paid">paid</option>
                <option value="processing">processing</option>
                <option value="shipped">shipped</option>
                <option value="cancelled">cancelled</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>Delivery fee ($)</label>
              <input
                className={inputClass}
                type="number"
                step={0.01}
                min={0}
                value={centsToDollarFieldValue(deliveryFeeCents)}
                onChange={(e) => setDeliveryFeeCents(parseDollarsToCents(e.target.value))}
              />
            </div>
            <div>
              <label className={labelClass}>Subtotal ($)</label>
              <input className={inputClass} value={centsToDollarFieldValue(subtotalCents)} readOnly />
            </div>
            <div>
              <label className={labelClass}>Total ($)</label>
              <input className={inputClass} value={centsToDollarFieldValue(totalCents)} readOnly />
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-lg font-semibold text-brand-navy">Items</h2>
            <button
              type="button"
              onClick={addItem}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-brand-navy hover:border-brand-orange"
            >
              + Add item
            </button>
          </div>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-100">
            <table className="min-w-[1000px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-600">
                  <th className="px-3 py-2">Product name</th>
                  <th className="px-3 py-2">Qty</th>
                  <th className="px-3 py-2">Unit ($)</th>
                  <th className="px-3 py-2">Line total ($)</th>
                  <th className="px-3 py-2">Service</th>
                  <th className="px-3 py-2">Color</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2">Placements JSON</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className="border-b border-slate-100 align-top last:border-b-0">
                    <td className="px-3 py-2">
                      <input
                        className={inputClass}
                        value={it.productName}
                        onChange={(e) => updateItem(idx, { productName: e.target.value })}
                      />
                      <input
                        className={inputClass}
                        value={it.productId}
                        onChange={(e) => updateItem(idx, { productId: e.target.value })}
                        placeholder="product_id (optional)"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={inputClass}
                        type="number"
                        min={0}
                        step={1}
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Math.max(0, safeInt(e.target.value, 0)) })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={inputClass}
                        type="number"
                        min={0}
                        step={0.01}
                        value={centsToDollarFieldValue(it.unitPriceCents)}
                        onChange={(e) => updateItem(idx, { unitPriceCents: parseDollarsToCents(e.target.value) })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={inputClass}
                        type="number"
                        min={0}
                        step={0.01}
                        value={centsToDollarFieldValue(it.lineTotalCents)}
                        onChange={(e) => updateItem(idx, { lineTotalCents: parseDollarsToCents(e.target.value) })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        className={inputClass}
                        value={it.serviceType}
                        onChange={(e) => updateItem(idx, { serviceType: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input className={inputClass} value={it.color} onChange={(e) => updateItem(idx, { color: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <input className={inputClass} value={it.size} onChange={(e) => updateItem(idx, { size: e.target.value })} />
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={it.placementsJson}
                        onChange={(e) => updateItem(idx, { placementsJson: e.target.value })}
                        onBlur={(e) => {
                          const t = e.target.value.trim();
                          if (!t) {
                            updateItem(idx, { placementsJson: "[]" });
                          }
                        }}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <textarea
                        className={inputClass}
                        rows={2}
                        value={it.notes}
                        onChange={(e) => updateItem(idx, { notes: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => removeItem(idx)}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-900 hover:bg-red-100"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-6 text-center text-sm text-slate-500">
                      No items. Add at least one item.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <form
            action={createInternalOrderFromTemplate}
            className="mt-5 flex flex-wrap items-center justify-between gap-3"
          >
            <input type="hidden" name="base_order_number" value={baseOrderNumber} />
            <input type="hidden" name="customer_email" value={customerEmail} />
            <input type="hidden" name="customer_name" value={customerName} />
            <input type="hidden" name="delivery_address" value={deliveryAddress} />
            <input type="hidden" name="currency" value={currency} />
            <input type="hidden" name="carrier" value={carrier} />
            <input type="hidden" name="status" value={status} />
            <input type="hidden" name="delivery_fee_cents" value={String(deliveryFeeCents)} />
            <input type="hidden" name="items_json" value={itemsJsonField} />
            <p className="text-xs text-slate-600">
              저장하면 새 주문이 생성됩니다. (기존 주문은 변경되지 않습니다.)
            </p>
            <button
              type="submit"
              className="rounded-xl bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
              disabled={items.length === 0}
            >
              Save as new internal order
            </button>
          </form>
        </section>
      </div>
    );
  }

  const printCustomerQuote = () => {
    document.body.classList.add("customer-quote-print-mode");
    const cleanup = () => {
      document.body.classList.remove("customer-quote-print-mode");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    window.print();
  };

  /* ——— Customer quote: spreadsheet-style sheet ——— */
  return (
    <div id="customer-quote-form" className="space-y-6">
      <section
        id="customer-quote-print-only"
        className="rounded-xl border-2 border-white bg-white p-4 shadow-sm sm:p-6"
      >
        <p className="mb-0 hidden text-center text-2xl font-bold tracking-tight text-brand-navy print:mb-4 print:block print:text-3xl">
          Quote
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2
              className={`text-lg font-semibold text-brand-navy${isBlankStarter ? " print:hidden" : ""}`}
            >
              {isBlankStarter ? "Quote (no template)" : "Quote details"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600 print:hidden">
              견적용 표입니다. 표 왼쪽 <strong>Add Line</strong>으로 새 품목 그룹을 넣을 수 있습니다. Supplier·Item
              ID·colour·Note는 그룹 첫 행에만 입력하고, 사이즈 행은 각 제품 앞의 <strong>Add Size</strong> 버튼으로
              이어 붙이세요.
            </p>
          </div>
          <div className="flex flex-wrap gap-[0.65rem] print:hidden">
            <button
              type="button"
              onClick={printCustomerQuote}
              className={`${customerQuoteToolbarBtn} bg-brand-navy text-white hover:bg-brand-navy/90`}
              title="인쇄 대화상자 열기"
            >
              Print
            </button>
          </div>
        </div>

        <div className="customer-quote-header-grid mt-5 border-2 border-white">
          <div className="grid grid-cols-[minmax(7rem,9rem)_1fr] border-b border-white text-sm">
            <div className="border-r border-white bg-slate-100 px-2 py-2 font-bold text-slate-900">Company</div>
            <input
              className={quoteCellInput}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="3927 IBS THERAPY GROUP"
              autoComplete="organization"
            />
          </div>
          <div className="grid grid-cols-[minmax(7rem,9rem)_1fr] border-b border-white text-sm">
            <div className="border-r border-white bg-slate-100 px-2 py-2 font-bold text-slate-900">Client name</div>
            <input
              className={quoteCellInput}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Contact name"
              autoComplete="name"
            />
          </div>
          <div className="grid grid-cols-[minmax(7rem,9rem)_1fr] border-b border-white text-sm">
            <div className="border-r border-white bg-slate-100 px-2 py-2 font-bold text-slate-900">Client contact</div>
            <input
              className={quoteCellInput}
              value={clientContact}
              onChange={(e) => setClientContact(e.target.value)}
              placeholder="Phone / mobile"
              autoComplete="tel"
            />
          </div>
          <div className="grid grid-cols-[minmax(7rem,9rem)_1fr] border-b border-white text-sm">
            <div className="border-r border-white bg-slate-100" aria-hidden="true" />
            <div className="min-h-3" aria-hidden="true" />
          </div>
          <div className="grid grid-cols-[minmax(7rem,9rem)_1fr] border-b border-white text-sm">
            <div className="border-r border-white bg-slate-100 px-2 py-2 font-bold text-slate-900">Delivery address</div>
            <textarea
              className={`${quoteCellInput} min-h-[5rem] resize-y`}
              rows={4}
              value={deliveryAddress}
              onChange={(e) => setDeliveryAddress(e.target.value)}
              placeholder="Street / full ship-to address"
            />
          </div>
          <div className="grid grid-cols-[minmax(7rem,9rem)_1fr] text-sm">
            <div className="border-r border-white bg-slate-100 px-2 py-2 font-bold text-slate-900">Email</div>
            <input
              className={quoteCellInput}
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              autoComplete="email"
            />
          </div>
        </div>

        <div className="customer-quote-print-scroll mt-5 overflow-x-auto">
          <table className="customer-quote-items-table min-w-[980px] w-full border-collapse border-t border-slate-900 text-sm">
            <tbody>
              <tr>
                <td
                  rowSpan={2}
                  className={`customer-quote-row-actions ${quoteTd} w-[5.5rem] min-w-[5.5rem] align-top bg-slate-50 p-2 print:hidden`}
                >
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={addQuoteProductGroup}
                      className="flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-brand-navy/40 bg-white px-1.5 py-3 text-center text-[11px] font-bold leading-tight text-brand-navy shadow-sm transition hover:border-brand-orange hover:bg-brand-orange/5 print:hidden"
                      title="Add a new line (product group) to the table"
                    >
                      <span className="text-lg leading-none text-brand-orange">+</span>
                      <span>Add Line</span>
                    </button>
                  </div>
                </td>
                <td colSpan={3} className={quoteTd}>
                  <div className="flex flex-wrap items-center gap-2 px-2 py-2">
                    <span className="text-xs font-bold uppercase text-slate-900">Quote no.</span>
                    <input
                      className={`${quoteCellInput} min-w-[12rem] flex-1 font-mono`}
                      value={baseOrderNumber}
                      onChange={(e) => setBaseOrderNumber(e.target.value)}
                      readOnly
                      title="Auto-generated quote number"
                      aria-label="Quote number"
                    />
                  </div>
                </td>
                <td colSpan={3} className={quoteTd}>
                  <div className="flex flex-wrap items-center gap-2 px-2 py-2">
                    <span className="text-xs font-bold uppercase text-slate-900">Date</span>
                    <input
                      type="date"
                      className={`${quoteCellInput} w-auto`}
                      value={orderDate}
                      onChange={(e) => setOrderDate(e.target.value)}
                    />
                  </div>
                </td>
                <td colSpan={3} className={quoteTd}>
                  <div className="flex flex-wrap items-center gap-2 px-2 py-2">
                    <span className="text-xs font-bold uppercase text-slate-900">Due date</span>
                    <input
                      type="date"
                      className={`${quoteCellInput} w-auto`}
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                    />
                  </div>
                </td>
              </tr>
              <tr>
                <th className={quoteTh}>Supplier</th>
                <th className={quoteTh}>Item ID</th>
                <th className={quoteTh}>colour</th>
                <th className={quoteTh}>M / F</th>
                <th className={quoteTh}>Size</th>
                <th className={quoteTh}>QTY</th>
                <th className={quoteTh}>Price/Item</th>
                <th className={quoteTh}>Total price</th>
                <th className={quoteTh}>Note</th>
              </tr>
              {items.map((it, idx) => {
                const g = it.quoteGroupId;
                const meta = quoteGroupMeta.get(g)!;
                const isFirstInGroup = meta.start === idx;
                const rowspan = meta.count;
                const showSupplier = isFirstInGroup ? (
                  <td rowSpan={rowspan} className={quoteTd}>
                    <input
                      className={quoteCellInput}
                      value={it.serviceType}
                      onChange={(e) => updateItem(idx, { serviceType: e.target.value })}
                      placeholder="e.g. AUSSIE"
                      data-latin-mode="ascii"
                    />
                  </td>
                ) : null;
                const showItemId = isFirstInGroup ? (
                  <td rowSpan={rowspan} className={quoteTd}>
                    <QuoteProductAutocomplete
                      id={`cq_item_${idx}`}
                      inputName={`cq_item_spec_${idx}`}
                      hiddenIdName={`cq_item_id_${idx}`}
                      catalog={catalog}
                      productId={it.catalogProductId}
                      spec={it.productId}
                      onChange={({ productId: catalogId, spec }) => {
                        const product = findQuoteCatalogProduct(catalog, catalogId);
                        const itemIdText = product ? product.styleCode ?? product.displayName : spec;
                        updateItem(idx, {
                          catalogProductId: catalogId,
                          productId: itemIdText,
                          productName: product?.displayName ?? itemIdText,
                          color: catalogId === it.catalogProductId ? it.color : "",
                        });
                      }}
                      placeholder="1302"
                      className={quoteCellInput}
                    />
                  </td>
                ) : null;
                const linkedProduct = findQuoteCatalogProduct(catalog, it.catalogProductId);
                const colorOptions = linkedProduct?.availableColors ?? [];
                const showColor = isFirstInGroup ? (
                  <td rowSpan={rowspan} className={quoteTd}>
                    {linkedProduct && colorOptions.length > 0 ? (
                      <select
                        className={`${quoteCellInput} cursor-pointer`}
                        value={it.color}
                        onChange={(e) => updateItem(idx, { color: e.target.value })}
                      >
                        <option value="">Select colour</option>
                        {colorOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        {it.color && !colorOptions.includes(it.color) ? (
                          <option value={it.color}>{it.color}</option>
                        ) : null}
                      </select>
                    ) : (
                      <input
                        className={quoteCellInput}
                        value={it.color}
                        onChange={(e) => updateItem(idx, { color: e.target.value })}
                        placeholder="NAVY/WHITE"
                        data-latin-mode="ascii"
                      />
                    )}
                  </td>
                ) : null;
                const showNote = isFirstInGroup ? (
                  <td rowSpan={rowspan} className={quoteTd}>
                    <textarea
                      className={`${quoteCellInput} min-h-[4rem] resize-y`}
                      value={it.notes}
                      onChange={(e) => updateItem(idx, { notes: e.target.value })}
                      placeholder="LOGO EMB # …"
                    />
                  </td>
                ) : null;

                return (
                  <tr key={idx}>
                    <td
                      className={`customer-quote-row-actions ${quoteTd} w-[5.5rem] min-w-[5.5rem] bg-slate-50/50 p-1 print:hidden`}
                    >
                      <div className="flex flex-col gap-1">
                        {isFirstInGroup ? (
                          <button
                            type="button"
                            onClick={() => selectQuoteGroupForSizeRow(g)}
                            className={`w-full rounded border px-1 py-2 text-[10px] font-bold leading-tight transition print:hidden ${
                              activeQuoteGroupId === g
                                ? "border-brand-orange bg-brand-orange/15 text-brand-navy"
                                : "border-brand-navy/25 bg-white text-brand-navy hover:border-brand-orange hover:bg-brand-orange/5"
                            }`}
                            title="Add a size row to this product"
                            aria-pressed={activeQuoteGroupId === g}
                          >
                            Add Size
                          </button>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="w-full rounded border border-red-300 bg-red-50 px-1 py-2 text-sm font-semibold leading-none text-red-900 hover:bg-red-100 print:hidden"
                          title="이 행 삭제"
                        >
                          ✕
                        </button>
                      </div>
                    </td>
                    {showSupplier}
                    {showItemId}
                    {showColor}
                    <td className={quoteTd}>
                      <select
                        className={`${quoteCellInput} cursor-pointer`}
                        value={it.gender || ""}
                        onChange={(e) => updateItem(idx, { gender: e.target.value })}
                      >
                        <option value="">—</option>
                        <option value="M">M</option>
                        <option value="F">F</option>
                      </select>
                    </td>
                    <td className={quoteTd}>
                      <input
                        className={quoteCellInput}
                        value={it.size}
                        onChange={(e) => updateItem(idx, { size: e.target.value })}
                        placeholder="S / M / L"
                        data-latin-mode="ascii"
                      />
                    </td>
                    <td className={`${quoteTd} text-left`}>
                      <input
                        className={`${quoteCellInput} text-left`}
                        type="number"
                        min={0}
                        step={1}
                        value={it.quantity}
                        onChange={(e) => updateItem(idx, { quantity: Math.max(0, safeInt(e.target.value, 0)) })}
                      />
                    </td>
                    <td className={quoteTd}>
                      <input
                        className={quoteCellInput}
                        type="text"
                        inputMode="decimal"
                        value={priceDrafts[idx] ?? String(centsToDollarFieldValue(it.unitPriceCents))}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setPriceDrafts((d) => ({ ...d, [idx]: raw }));
                          updateItem(idx, { unitPriceCents: parseDollarsToCents(raw) });
                        }}
                        onBlur={() =>
                          setPriceDrafts((d) => {
                            const { [idx]: _drop, ...rest } = d;
                            return rest;
                          })
                        }
                        placeholder="0.00"
                        data-latin-mode="decimal"
                      />
                    </td>
                    <td className={quoteTd}>
                      <input
                        className={quoteCellInput}
                        type="text"
                        inputMode="decimal"
                        value={totalDrafts[idx] ?? String(centsToDollarFieldValue(it.lineTotalCents))}
                        onChange={(e) => {
                          const raw = e.target.value;
                          setTotalDrafts((d) => ({ ...d, [idx]: raw }));
                          updateItem(idx, { lineTotalCents: parseDollarsToCents(raw) });
                        }}
                        onBlur={() =>
                          setTotalDrafts((d) => {
                            const { [idx]: _drop, ...rest } = d;
                            return rest;
                          })
                        }
                        placeholder="0.00"
                        data-latin-mode="decimal"
                      />
                    </td>
                    {showNote}
                  </tr>
                );
              })}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={10} className={`${quoteTd} px-4 py-8 text-center text-slate-600`}>
                    행이 없습니다. 왼쪽 열의 <strong>Add Line</strong>으로 시작하세요.
                  </td>
                </tr>
              ) : null}

              <tr>
                <td colSpan={6} className={`${quoteTd} bg-white px-2 py-2 text-left font-semibold text-slate-800`}>
                  Line subtotal
                </td>
                <td className={`${quoteTd} bg-white px-2 py-2 text-left font-medium tabular-nums text-slate-800`}>
                  {sumQty}
                </td>
                <td className={quoteTd}></td>
                <td className={`${quoteTd} bg-white font-semibold tabular-nums text-slate-800`}>
                  {formatAud(subtotalCents)}
                </td>
                <td className={quoteTd}></td>
              </tr>
              <tr>
                <td colSpan={6} className={`${quoteTd} bg-slate-50 px-2 py-2 font-semibold text-slate-900`}>
                  Set up fee
                </td>
                <td className={quoteTd}></td>
                <td className={quoteTd}></td>
                <td className={quoteTd}>
                  <input
                    className={quoteCellInput}
                    type="number"
                    min={0}
                    step={0.01}
                    value={centsToDollarFieldValue(setupFeeCents)}
                    onChange={(e) => setSetupFeeCents(parseDollarsToCents(e.target.value))}
                  />
                </td>
                <td className={quoteTd}></td>
              </tr>
              <tr>
                <td colSpan={6} className={`${quoteTd} bg-slate-50 px-2 py-2 font-semibold text-slate-900`}>
                  Delivery fee
                </td>
                <td className={quoteTd}></td>
                <td className={quoteTd}></td>
                <td className={quoteTd}>
                  <input
                    className={quoteCellInput}
                    type="number"
                    min={0}
                    step={0.01}
                    value={centsToDollarFieldValue(quoteDeliveryFeeCents)}
                    onChange={(e) => setQuoteDeliveryFeeCents(parseDollarsToCents(e.target.value))}
                  />
                </td>
                <td className={quoteTd}></td>
              </tr>
              <tr>
                <td colSpan={6} className={`${quoteTd} bg-slate-50 px-2 py-2 text-left font-semibold text-slate-900`}>
                  SUM
                </td>
                <td className={`${quoteTd} bg-slate-50 px-2 py-2 text-left`}></td>
                <td className={quoteTd}></td>
                <td className={`${quoteTd} bg-slate-50 font-semibold tabular-nums`}></td>
                <td className={quoteTd}></td>
              </tr>
              <tr>
                <td colSpan={6} className={`${quoteTd} bg-slate-50 px-2 py-2 font-semibold text-slate-900`}>
                  GST (10%)
                </td>
                <td colSpan={2} className={quoteTd}></td>
                <td className={`${quoteTd} bg-slate-50 font-semibold tabular-nums`}>{formatAud(quoteGstCents)}</td>
                <td className={quoteTd}></td>
              </tr>
              <tr>
                <td colSpan={6} className={`${quoteTd} bg-slate-50 px-2 py-2 font-semibold text-slate-900`}>
                  DEPOSIT
                </td>
                <td colSpan={2} className={quoteTd}></td>
                <td className={quoteTd}>
                  <input
                    className={quoteCellInput}
                    type="number"
                    min={0}
                    step={0.01}
                    value={centsToDollarFieldValue(depositCents)}
                    onChange={(e) => setDepositCents(parseDollarsToCents(e.target.value))}
                  />
                </td>
                <td className={quoteTd}></td>
              </tr>
              <tr>
                <td colSpan={6} className={`${quoteTd} bg-slate-100 px-2 py-2 text-base font-bold text-brand-navy`}>
                  TOTAL Balance
                </td>
                <td colSpan={2} className={`${quoteTd} bg-slate-100`}></td>
                <td className={`${quoteTd} bg-slate-100 text-base font-bold tabular-nums text-brand-navy`}>
                  {formatAud(quoteTotalBalanceCents)}
                </td>
                <td className={`${quoteTd} bg-slate-100`}></td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-200 pt-4 text-sm">
          <div>
            <label className={labelClass}>Currency</label>
            <input className={inputClass} value={currency} onChange={(e) => setCurrency(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Carrier</label>
            <input className={inputClass} value={carrier} onChange={(e) => setCarrier(e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              className={inputClass}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "unpaid" | "paid" | "processing" | "shipped" | "cancelled")
              }
            >
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500 print:hidden">
          저장 시 DB <code className="rounded bg-slate-100 px-1">subtotal</code>은 SUM(품목+Set up fee+Delivery fee)과 같고,{" "}
          <code className="rounded bg-slate-100 px-1">delivery_fee</code> 컬럼에는 GST 금액이 들어가며,{" "}
          <code className="rounded bg-slate-100 px-1">total</code>은 TOTAL Balance와 같습니다.
        </p>

        <div className="mt-5 border-2 border-white p-3 print:border-slate-200">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-6 md:items-start">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 print:hidden">
                Quote images &amp; note
              </p>
              <div className="mt-2">
                <CustomerQuoteImageDropzone
                  quoteRequestId={quoteRequestId}
                  imageUrls={quoteBoxImageUrls}
                  onImageUrlsChange={setQuoteBoxImageUrls}
                />
              </div>
            </div>
            <div className="flex min-w-0 flex-col">
              <label className={labelClass}>Note</label>
              <textarea
                className={`${inputClass} min-h-[10rem] flex-1 md:min-h-[12rem]`}
                rows={4}
                value={quoteBoxNote}
                onChange={(e) => setQuoteBoxNote(e.target.value)}
                placeholder="Internal note for this quote (visible when reopened; included on Save Quote)"
              />
            </div>
          </div>
        </div>

        <form
          action={createInternalOrderFromTemplate}
          className="mt-5 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4 print:hidden"
        >
          <input
            type="hidden"
            name="source"
            value={isInternalOrderQuote ? "internal-quote" : "customer-quote"}
          />
          <input type="hidden" name="quote_request_id" value={quoteRequestId ?? ""} />
          <input type="hidden" name="base_order_number" value={baseOrderNumber} />
          <input type="hidden" name="customer_email" value={customerEmail} />
          <input type="hidden" name="customer_name" value={customerName} />
          <input type="hidden" name="delivery_address" value={composedQuoteDelivery} />
          <input type="hidden" name="currency" value={currency} />
          <input type="hidden" name="carrier" value={carrier} />
          <input type="hidden" name="status" value={status} />
          <input type="hidden" name="quote_setup_fee_cents" value={String(setupFeeCents)} />
          <input type="hidden" name="quote_delivery_fee_cents" value={String(quoteDeliveryFeeCents)} />
          <input type="hidden" name="quote_deposit_cents" value={String(depositCents)} />
          <input type="hidden" name="items_json" value={itemsJsonField} />
          <p className="mr-auto max-w-xl text-xs text-slate-600">
            {isInternalOrderQuote ? (
              <>
                <strong>Make Store order</strong>로 스토어 주문을 생성합니다. M/F는 스토어 품목 메모 앞에 붙어 저장됩니다.
              </>
            ) : (
              <>
                <strong>Save Quote</strong>는 CRM 견적 목록에만 저장합니다. 주문을 만들려면 <strong>Make Store order</strong>를 누르세요. M/F는 스토어
                품목 메모 앞에 붙어 저장됩니다.
              </>
            )}
          </p>
          {!isInternalOrderQuote ? (
            <>
              <button
                type="button"
                className="rounded-xl border border-emerald-800 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50 disabled:opacity-60"
                disabled={items.length === 0 || saveQuotePending || xeroQuotePending || !customerQuoteSheetPayload}
                onClick={() => {
                  if (!customerQuoteSheetPayload) return;
                  setSaveQuoteError(null);
                  startSaveQuoteTransition(async () => {
                    try {
                      await saveCustomerQuoteSheet(
                        customerQuoteSheetPayload,
                        quoteRequestId,
                        quoteSaveReturnBase,
                      );
                    } catch (e) {
                      if (isNextNavigationError(e)) {
                        throw e;
                      }
                      setSaveQuoteError(
                        e instanceof Error ? e.message : "Could not save quote. Refresh and try again.",
                      );
                    }
                  });
                }}
              >
                {saveQuotePending ? "Saving…" : "Save Quote"}
              </button>
              <button
                type="button"
                className="rounded-xl border border-sky-800 bg-white px-5 py-2.5 text-sm font-semibold text-sky-900 shadow-sm transition hover:bg-sky-50 disabled:opacity-60"
                disabled={
                  items.length === 0 ||
                  saveQuotePending ||
                  xeroQuotePending ||
                  !customerQuoteSheetPayload ||
                  !customerEmail.trim() ||
                  !customerName.trim()
                }
                onClick={() => {
                  if (!customerQuoteSheetPayload) return;
                  setXeroQuoteError(null);
                  startXeroQuoteTransition(async () => {
                    try {
                      const res = await fetch("/api/admin/xero/sync-quote", {
                        method: "POST",
                        credentials: "same-origin",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          sheet: customerQuoteSheetPayload,
                          quoteRequestId,
                        }),
                      });
                      const data = await readResponseJson<{
                        ok?: boolean;
                        error?: string;
                        quoteId?: string;
                        quoteNumber?: string;
                        openUrl?: string;
                        alreadySynced?: boolean;
                      }>(res);
                      if (!data) {
                        setXeroQuoteError(
                          res.ok
                            ? "Empty response from server."
                            : `Server error (${res.status}). Refresh and try again.`,
                        );
                        return;
                      }
                      if (!res.ok || !data.ok || !data.quoteId || !data.openUrl) {
                        setXeroQuoteError(data.error ?? "Could not create Xero quote.");
                        return;
                      }
                      setXeroQuoteId(data.quoteId);
                      setXeroQuoteNumber(data.quoteNumber ?? null);
                      if (!data.alreadySynced) {
                        setXeroQuoteSyncedAt(new Date().toISOString());
                      }
                      window.open(data.openUrl, "_blank", "noopener,noreferrer");
                    } catch (e) {
                      setXeroQuoteError(
                        e instanceof Error ? e.message : "Could not create Xero quote. Refresh and try again.",
                      );
                    }
                  });
                }}
              >
                {xeroQuotePending ? "Sending…" : xeroQuoteId ? "Update Xero Quote" : "Xero Quote"}
              </button>
            </>
          ) : null}
          {saveQuoteError ? (
            <p className="w-full basis-full text-sm text-red-700" role="alert">
              {saveQuoteError}
            </p>
          ) : null}
          {xeroQuoteError ? (
            <p className="w-full basis-full text-sm text-red-700" role="alert">
              {xeroQuoteError}
            </p>
          ) : null}
          {xeroQuoteId && xeroQuoteNumber ? (
            <p className="w-full basis-full text-xs text-slate-600">
              Xero quote <strong>{xeroQuoteNumber}</strong>
              {xeroQuoteSyncedAt ? ` · synced ${new Date(xeroQuoteSyncedAt).toLocaleString("en-AU")}` : null}
            </p>
          ) : null}
          <button
            type="submit"
            className="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
            disabled={items.length === 0}
          >
            Make Store order
          </button>
        </form>
      </section>
    </div>
  );
}
