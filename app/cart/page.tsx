"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { ImageUrlLightbox } from "@/app/components/image-url-lightbox";
import { ArrowLeftIcon, CartIcon } from "@/app/components/icons";
import { SendCartQuoteButton } from "@/app/cart/send-cart-quote-button";
import { TopNav } from "@/app/components/top-nav";
import type { CreateCustomerQuotePayload } from "@/lib/customer-quote";
import type { StoreOrderCartLine } from "@/lib/store-order-cart-payload";
import { readResponseJson } from "@/lib/safe-json-parse";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";
import { STORE_GOOGLE_MAPS_QUERY, storeGoogleMapsSearchHref } from "@/lib/store-google-maps-url";
import { extractAustralianPostcodeFromAddress } from "@/lib/customer-delivery-estimate";
import {
  CHECKOUT_PICK_UP_SESSION_KEY,
  STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD,
  STOREFRONT_LOGO_SETUP_BEFORE_GST_AUD,
  computeStorefrontCheckoutFees,
  logoSetupFeeInclGstAud,
} from "@/lib/storefront-cart-checkout-fees";
import { totalEstimatedShippingWeightKg } from "@/lib/delivery-shipping-weight";
import {
  enforceCartPrivacyOnCustomerSessionEnd,
  getCartItems,
  getReorderMockupImageUrls,
  removeCartItem,
  subscribeCartUpdates,
  type CartItem,
} from "@/lib/cart";
import { productPathSegment } from "@/lib/product-path-slug";
import { serviceTypeColoredContent } from "@/lib/service-type-colored";
import { resolveStorefrontImageUrl } from "@/lib/storefront-image-url";
import { STORE_MAIN_SHELL_CLASS } from "@/lib/store-main-shell";
import {
  sortStorefrontCartLinesHeadwearLast,
  storefrontCartNetProductSubtotalAfterVolumeAud,
  volumeAdjustedCartLinePricesById,
} from "@/lib/storefront-volume-discount";

/** When a cart line has no stored image (legacy cart or missing DB image). */
const CART_LINE_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80";

function toCurrency(amount: number) {
  return amount.toLocaleString("en-AU", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function PricingDeliveryNotesCollapsible() {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 rounded-xl border border-white/15 bg-white/5 p-3 text-[0.95rem] leading-snug text-slate-200">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 rounded-lg py-0.5 text-left font-semibold text-slate-100 transition hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange/60"
      >
        <span>Pricing &amp; delivery notes</span>
        <svg
          className={`h-5 w-5 shrink-0 text-slate-300 transition-transform duration-300 ease-out motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden
        >
          <path
            fillRule="evenodd"
            d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z"
            clipRule="evenodd"
          />
        </svg>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-300 ease-out motion-reduce:transition-none"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="min-h-0 overflow-hidden">
          <ul className="mt-2 list-inside list-disc space-y-1.5 pb-0.5 text-slate-300">
            <li>
              Product subtotal under {toCurrency(STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD)}: your{" "}
              <strong className="font-medium text-slate-200">first</strong> embroidery order includes a one-off Logo
              setup fee ({toCurrency(STOREFRONT_LOGO_SETUP_BEFORE_GST_AUD)} + GST,{" "}
              {toCurrency(logoSetupFeeInclGstAud())} incl. GST).
            </li>
            <li>
              <strong className="font-medium text-slate-200">New logo files</strong> on an embroidery line (same fee)
              apply even if you have ordered embroidery before — upload artwork at add-to-cart.
            </li>
            <li>
              Product subtotal {toCurrency(STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD)} or more: Logo setup is{" "}
              <strong className="font-medium text-slate-200">waived</strong>. Delivery fees apply Australia-wide
              (estimated from your postcode and chargeable weight).
            </li>
            <li>
              Estimated for all areas from your postcode and total{" "}
              <strong className="font-medium text-slate-200">chargeable</strong> weight (per item: the higher of packed
              weight or cubic weight, by product type).
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

function isCartMockupRenderableImageUrl(url: string) {
  const base = (url.split("?")[0] ?? url).toLowerCase();
  return /\.(png|jpe?g|gif|webp|svg)$/i.test(base);
}

function getCookieValue(name: string) {
  if (typeof document === "undefined") {
    return "";
  }
  const key = `${name}=`;
  const found = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(key));
  return found ? decodeURIComponent(found.slice(key.length)) : "";
}

function CartLineDetailBody({ item }: { item: CartItem }) {
  return (
    <div className="space-y-[1.125rem] text-[1.125rem] leading-relaxed text-brand-navy/85 sm:text-[1.21875rem]">
      <p>
        <span className="font-semibold text-brand-navy/65">Service</span>{" "}
        {serviceTypeColoredContent(item.serviceType)}
      </p>
      {item.placements.length > 0 && (
        <div>
          {item.placements.some((entry) => entry.startsWith("Embroidery:")) ||
          item.placements.some((entry) => entry.startsWith("Printing:")) ? (
            <div className="space-y-1.5">
              {item.placements
                .filter((entry) => entry.startsWith("Embroidery:"))
                .map((entry) => (
                  <p key={`emb-${item.id}-${entry}`}>{entry}</p>
                ))}
              {item.placements
                .filter((entry) => entry.startsWith("Printing:"))
                .map((entry) => (
                  <p key={`prn-${item.id}-${entry}`}>{entry}</p>
                ))}
              {item.placements
                .filter((entry) => !entry.startsWith("Embroidery:") && !entry.startsWith("Printing:"))
                .map((entry) => (
                  <p key={`etc-${item.id}-${entry}`}>{entry}</p>
                ))}
            </div>
          ) : (
            <p>Placement: {item.placements.join(", ")}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [reorderMockupUrls, setReorderMockupUrls] = useState<string[]>([]);
  const [reorderMockupLightboxSrc, setReorderMockupLightboxSrc] = useState<string | null>(null);
  const [deliveryPostcode, setDeliveryPostcode] = useState<string | null>(null);
  const [isCustomerSignedIn, setIsCustomerSignedIn] = useState(false);
  const [hasPriorEmbroideryOrder, setHasPriorEmbroideryOrder] = useState<boolean | null>(null);
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [pickUp, setPickUp] = useState(false);
  const [detailItemId, setDetailItemId] = useState<string | null>(null);

  useEffect(() => {
    enforceCartPrivacyOnCustomerSessionEnd();
    const syncSessionCookies = () => {
      setIsCustomerSignedIn(Boolean(getCookieValue("customer_email").trim()));
      const deliveryAddress = getCookieValue("customer_delivery_address");
      setDeliveryPostcode(extractAustralianPostcodeFromAddress(deliveryAddress));
    };
    const sync = () => {
      setItems(getCartItems());
      setReorderMockupUrls(getReorderMockupImageUrls());
      syncSessionCookies();
    };
    sync();
    const unsubscribe = subscribeCartUpdates(sync);
    const onRefocus = () => syncSessionCookies();
    window.addEventListener("focus", onRefocus);
    document.addEventListener("visibilitychange", onRefocus);
    return () => {
      unsubscribe();
      window.removeEventListener("focus", onRefocus);
      document.removeEventListener("visibilitychange", onRefocus);
    };
  }, []);

  useEffect(() => {
    if (!isCustomerSignedIn) {
      setHasPriorEmbroideryOrder(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/customer/has-prior-embroidery-order", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setHasPriorEmbroideryOrder(null);
          return;
        }
        const data = await readResponseJson<{ hasPriorEmbroideryOrder?: boolean }>(res);
        if (!cancelled) setHasPriorEmbroideryOrder(Boolean(data?.hasPriorEmbroideryOrder));
      } catch {
        if (!cancelled) setHasPriorEmbroideryOrder(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isCustomerSignedIn]);

  useEffect(() => {
    if (!isCustomerSignedIn) {
      setPickUp(false);
      try {
        sessionStorage.removeItem(CHECKOUT_PICK_UP_SESSION_KEY);
      } catch {
        // ignore
      }
    }
  }, [isCustomerSignedIn]);

  useEffect(() => {
    if (!isCustomerSignedIn) return;
    try {
      if (pickUp) {
        sessionStorage.setItem(CHECKOUT_PICK_UP_SESSION_KEY, "1");
      } else {
        sessionStorage.removeItem(CHECKOUT_PICK_UP_SESSION_KEY);
      }
    } catch {
      // ignore
    }
  }, [pickUp, isCustomerSignedIn]);

  useEffect(() => {
    if (detailItemId && !items.some((i) => i.id === detailItemId)) {
      setDetailItemId(null);
    }
  }, [items, detailItemId]);

  useEffect(() => {
    if (!detailItemId) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDetailItemId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailItemId]);

  const {
    gross: productGrossSubtotal,
    net: productNetSubtotal,
    volumeDiscountAud,
  } = useMemo(() => storefrontCartNetProductSubtotalAfterVolumeAud(items), [items]);
  const volumeAdjustedByLineId = useMemo(
    () => volumeAdjustedCartLinePricesById(items),
    [items],
  );
  const displayItems = useMemo(() => sortStorefrontCartLinesHeadwearLast(items), [items]);

  const totalQuantity = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const estimatedWeightKg = useMemo(() => totalEstimatedShippingWeightKg(items), [items]);

  const checkoutFees = useMemo(
    () =>
      computeStorefrontCheckoutFees({
        subtotalAud: productNetSubtotal,
        items,
        deliveryPostcode,
        estimatedWeightKg,
        isCustomerSignedIn,
        hasPriorEmbroideryOrder,
        pickUp: isCustomerSignedIn && pickUp,
      }),
    [
      productNetSubtotal,
      items,
      deliveryPostcode,
      estimatedWeightKg,
      isCustomerSignedIn,
      hasPriorEmbroideryOrder,
      pickUp,
    ],
  );
  const { deliveryFeeAud, logoSetupFeeAud, logoSetupApplies, totalAud: payableTotal } = checkoutFees;
  const canCheckOut = termsAgreed && isCustomerSignedIn;

  const quotePayload = useMemo<CreateCustomerQuotePayload>(() => {
    const toCents = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100);
    const lines: StoreOrderCartLine[] = items.map((item) => {
      const priced = volumeAdjustedByLineId.get(item.id);
      const { id: _id, addedAt: _addedAt, ...rest } = item;
      return {
        ...rest,
        unitPrice: priced?.unitPrice ?? item.unitPrice,
        totalPrice: priced?.totalPrice ?? item.totalPrice,
      };
    });
    const appliedLogoSetupAud = isCustomerSignedIn && logoSetupApplies ? logoSetupFeeAud : 0;
    const appliedDeliveryAud = isCustomerSignedIn && !pickUp ? deliveryFeeAud : 0;
    return {
      lines,
      productGrossCents: toCents(productGrossSubtotal),
      volumeDiscountCents: toCents(volumeDiscountAud),
      productNetCents: toCents(productNetSubtotal),
      logoSetupCents: toCents(appliedLogoSetupAud),
      deliveryCents: toCents(appliedDeliveryAud),
      totalCents: toCents(payableTotal),
      totalQuantity,
      pickup: isCustomerSignedIn && pickUp,
    };
  }, [
    items,
    volumeAdjustedByLineId,
    productGrossSubtotal,
    volumeDiscountAud,
    productNetSubtotal,
    logoSetupFeeAud,
    logoSetupApplies,
    deliveryFeeAud,
    payableTotal,
    totalQuantity,
    pickUp,
    isCustomerSignedIn,
  ]);

  const detailItem = detailItemId ? items.find((i) => i.id === detailItemId) : undefined;

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <div className={STORE_MAIN_SHELL_CLASS}>
        <section className={`${SITE_PAGE_ROW_CLASS} py-10`}>
        <div className="mx-auto w-[70%] max-w-full min-w-0">
        <header className="mb-7">
          <div className="flex flex-col">
            <Link
              href="/"
              className="flex w-fit items-center gap-2 text-[1.3125rem] font-semibold leading-tight text-brand-orange"
            >
              <ArrowLeftIcon className="h-6 w-6 shrink-0" />
              Back to products
            </Link>
            <h1 className="mt-8 flex items-center gap-2 text-3xl font-medium sm:text-4xl">
              <CartIcon className="h-12 w-12" />
              Cart
            </h1>
            <p className="mt-2 text-[1.3125rem] leading-snug text-brand-navy/70">
              Review selected products and pricing before requesting a quote.
            </p>
          </div>
        </header>

        {!items.length && (
          <div className="rounded-2xl border border-brand-navy/15 bg-brand-surface px-5 py-6 text-sm text-brand-navy/70">
            Your cart is empty.
          </div>
        )}

        {!!items.length && (
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              {displayItems.map((item) => {
                const priced = volumeAdjustedByLineId.get(item.id);
                const showLineTotal = priced?.totalPrice ?? item.totalPrice;
                const showUnit =
                  priced?.unitPrice ??
                  (item.quantity > 0
                    ? Math.round((showLineTotal / item.quantity) * 100) / 100
                    : item.unitPrice);
                const heroSrc = (() => {
                  const raw = typeof item.imageUrl === "string" ? item.imageUrl.trim() : "";
                  if (!raw) return CART_LINE_FALLBACK_IMAGE;
                  return resolveStorefrontImageUrl(raw) || raw || CART_LINE_FALLBACK_IMAGE;
                })();
                const thumbAlt =
                  item.productName.trim().length > 0 ? `${item.productName} — preview` : "Product preview";
                return (
                  <article
                    key={item.id}
                    className="rounded-none border-0 border-b border-brand-navy/15 bg-white p-5 pb-6"
                  >
                    <div className="flex flex-wrap items-start gap-4">
                      <div className="flex min-h-[9rem] min-w-[5.25rem] shrink-0 flex-col items-center justify-center px-3 py-4 sm:min-h-[10rem] sm:min-w-[6rem] sm:px-4">
                        <span className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-brand-navy/45">
                          Size
                        </span>
                        <span
                          className="mt-2 max-w-[5.5rem] text-center text-[2.125rem] font-bold leading-none tracking-tight text-brand-navy sm:max-w-none sm:text-[2.5rem]"
                          title={(item.size || "").trim() || undefined}
                        >
                          {(item.size || "").trim() || "—"}
                        </span>
                      </div>
                      <div className="relative mx-auto h-36 w-full max-w-[10rem] shrink-0 overflow-hidden rounded-xl bg-brand-surface/40 sm:mx-0 sm:h-40 sm:max-w-[11rem]">
                        <img
                          src={heroSrc}
                          alt={thumbAlt}
                          className="absolute inset-0 h-full w-full object-contain object-center"
                        />
                      </div>
                      <div className="flex min-w-0 flex-1 basis-full flex-col gap-4 sm:basis-0">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 max-w-full flex-1 space-y-2">
                            <p className="min-w-0 text-[1.366875rem] font-medium leading-snug">
                              <span>{item.productName}</span>
                              <span className="font-normal text-brand-navy/45"> · </span>
                              <span className="font-normal text-brand-navy/70">
                                Colour : {(item.color || "").trim() || "N/A"}
                              </span>
                            </p>
                            <p className="text-[1.5309rem] text-brand-navy/70">QTY: {item.quantity}</p>
                            <button
                              type="button"
                              aria-expanded={detailItemId === item.id}
                              onClick={() => setDetailItemId((cur) => (cur === item.id ? null : item.id))}
                              className="w-fit shrink-0 rounded-lg border border-brand-navy/25 px-4 py-2 text-[1.063125rem] font-semibold transition hover:border-brand-orange hover:text-brand-orange"
                            >
                              {detailItemId === item.id ? "Hide detail" : "Detail"}
                            </button>
                          </div>
                          <div className="text-right">
                            <p className="text-[1.5309rem] text-brand-navy/65">Unit: {toCurrency(showUnit)}</p>
                            <p className="text-[1.51875rem] font-medium leading-tight text-brand-orange">
                              {toCurrency(showLineTotal)}
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-wrap justify-end gap-2 sm:mt-0">
                          <Link
                            href={`/products/${encodeURIComponent(item.productPathSlug ?? productPathSegment({ name: item.productName, slug: null }))}?${new URLSearchParams({ cartEdit: item.id }).toString()}`}
                            className="rounded-lg border border-brand-navy/25 px-4 py-2 text-[1.063125rem] font-semibold transition hover:border-brand-orange hover:text-brand-orange"
                          >
                            Edit
                          </Link>
                          <button
                            type="button"
                            onClick={() => removeCartItem(item.id)}
                            className="rounded-lg border border-brand-navy/25 px-4 py-2 text-[1.063125rem] font-semibold transition hover:border-brand-orange hover:text-brand-orange"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}

              {reorderMockupUrls.length > 0 ? (
                <section
                  className="rounded-2xl border border-brand-navy/15 bg-brand-surface/40 px-5 py-5"
                  aria-label="Saved order mockups"
                >
                  <h2 className="text-[1.2rem] font-semibold text-brand-navy">Mockups from your reordered order</h2>
                  <p className="mt-1 text-[1.05rem] text-brand-navy/65">
                    Reference artwork saved for this customer order (admin mock-ups).
                  </p>
                  <div className="mt-4 flex flex-wrap gap-4">
                    {reorderMockupUrls.map((url) =>
                      isCartMockupRenderableImageUrl(url) ? (
                        <button
                          key={url}
                          type="button"
                          onClick={() => setReorderMockupLightboxSrc(url)}
                          className="block shrink-0 cursor-zoom-in rounded-xl border border-brand-navy/10 bg-white p-2 text-left shadow-sm transition hover:border-brand-orange/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"
                          aria-label="View mock-up larger"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt="Order mockup"
                            className="pointer-events-none max-h-64 max-w-[min(100%,20rem)] object-contain"
                            loading="lazy"
                            decoding="async"
                          />
                        </button>
                      ) : (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-xl border border-brand-orange/40 bg-white px-4 py-3 text-[1.05rem] font-semibold text-brand-orange underline-offset-2 hover:underline"
                        >
                          Open mockup file
                        </a>
                      ),
                    )}
                  </div>
                  <ImageUrlLightbox
                    open={Boolean(reorderMockupLightboxSrc)}
                    onClose={() => setReorderMockupLightboxSrc(null)}
                    src={reorderMockupLightboxSrc ?? ""}
                    alt="Order mockup"
                    ariaLabel="Enlarged order mock-up"
                    enlarged
                  />
                </section>
              ) : null}

              <SendCartQuoteButton isSignedIn={isCustomerSignedIn} payload={quotePayload} />
            </div>

            <aside className="h-fit rounded-2xl border border-brand-navy/15 bg-brand-navy p-5 text-white">
              <h2 className="text-[1.3125rem] font-medium uppercase tracking-[0.1em] text-slate-200">
                Cart Summary
              </h2>
              <PricingDeliveryNotesCollapsible />
              <div className="mt-4 space-y-2 text-[1.3125rem]">
                <p className="flex items-center justify-between">
                  <span>Total items</span>
                  <span className="font-semibold">{totalQuantity}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Cart lines</span>
                  <span className="font-semibold">{items.length}</span>
                </p>
                <p className="flex items-center justify-between border-t border-white/10 pt-2">
                  <span>Product list subtotal</span>
                  <span className="font-semibold">{toCurrency(productGrossSubtotal)}</span>
                </p>
                {volumeDiscountAud > 0 ? (
                  <p className="flex items-center justify-between text-slate-300">
                    <span>Volume discount</span>
                    <span className="font-semibold">−{toCurrency(volumeDiscountAud)}</span>
                  </p>
                ) : null}
                <p className="flex items-center justify-between">
                  <span>Product subtotal</span>
                  <span className="font-semibold">{toCurrency(productNetSubtotal)}</span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Logo setup fee</span>
                  <span className="font-semibold text-right">
                    {!isCustomerSignedIn ? (
                      <span className="text-slate-300">Sign in to confirm</span>
                    ) : !items.some((i) => (i.serviceType ?? "").toLowerCase().includes("embroidery")) ? (
                      "—"
                    ) : logoSetupApplies ? (
                      toCurrency(logoSetupFeeAud)
                    ) : (
                      "Waived"
                    )}
                  </span>
                </p>
                <p className="flex items-center justify-between">
                  <span>Delivery fee</span>
                  <span className="font-semibold">
                    {!isCustomerSignedIn
                      ? toCurrency(0)
                      : pickUp
                        ? "Pick up"
                        : deliveryFeeAud === 0
                          ? "Free"
                          : toCurrency(deliveryFeeAud)}
                  </span>
                </p>
                {isCustomerSignedIn ? (
                  <div className="space-y-2">
                    <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[0.95rem] text-slate-200">
                      <input
                        type="checkbox"
                        checked={pickUp}
                        onChange={(e) => setPickUp(e.target.checked)}
                        className="h-4 w-4 shrink-0 rounded border-white/30 bg-white/10 text-brand-orange focus:ring-brand-orange"
                      />
                      <span className="font-semibold text-slate-100">Pick up</span>
                    </label>
                    {pickUp ? (
                      <p className="px-1 text-[0.9rem] leading-snug text-slate-300">
                        <a
                          href={storeGoogleMapsSearchHref()}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-semibold text-brand-orange underline hover:text-brand-orange/90"
                          title={STORE_GOOGLE_MAPS_QUERY}
                        >
                          Click to view on Google Maps
                        </a>
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {!isCustomerSignedIn ? (
                  <p className="text-[0.95rem] leading-snug text-slate-400">
                    <Link href="/log-in" className="font-semibold text-brand-orange underline hover:text-brand-orange/90">
                      Sign in
                    </Link>{" "}
                    to estimate delivery and Logo setup from your saved address. Until then, delivery is shown as{" "}
                    {toCurrency(0)}.
                  </p>
                ) : null}
              </div>
              <div className="mt-4 border-t border-white/15 pt-4">
                <p className="text-[1.3125rem] text-slate-300">Total payable</p>
                <p className="text-[2.8125rem] font-medium leading-tight text-brand-orange">
                  {toCurrency(payableTotal)}
                </p>
              </div>
              <div className="mt-4 rounded-xl border border-white/20 bg-white/5 p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={termsAgreed}
                    onChange={(e) => setTermsAgreed(e.target.checked)}
                    className="mt-1.5 h-6 w-6 shrink-0 rounded border-white/30 bg-white/10 text-brand-orange focus:ring-brand-orange"
                  />
                  <span className="text-[1.3125rem] text-slate-200">
                    I have read and agree to the{" "}
                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          "/terms-and-conditions",
                          "terms",
                          "width=560,height=720,scrollbars=yes,resizable=yes"
                        )
                      }
                      className="font-semibold text-brand-orange underline hover:text-brand-orange/90"
                    >
                      Terms & Conditions
                    </button>
                  </span>
                </label>
              </div>
              {canCheckOut ? (
                <Link
                  href="/payment"
                  className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-brand-orange px-4 py-3 text-[1.8rem] font-medium text-brand-navy transition hover:brightness-95"
                >
                  Check out
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  className="mt-5 inline-flex w-full cursor-not-allowed items-center justify-center rounded-xl bg-slate-500 px-4 py-3 text-[1.8rem] font-medium text-slate-100 transition"
                >
                  Check out
                </button>
              )}
              {!isCustomerSignedIn && items.length > 0 ? (
                <p className="mt-2 text-center text-[1.5rem] text-slate-300">
                  <Link href="/log-in" className="font-semibold text-brand-orange underline hover:text-brand-orange/90">
                    Sign in
                  </Link>{" "}
                  to enable checkout.
                </p>
              ) : null}
            </aside>
          </div>
        )}
        </div>
        </section>
      </div>

      {detailItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="presentation"
          onClick={() => setDetailItemId(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="cart-detail-title"
            className="max-h-[min(88vh,48rem)] w-full max-w-[42rem] overflow-y-auto rounded-2xl border border-brand-navy/15 bg-white p-[1.875rem] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-[1.125rem] border-b border-brand-navy/10 pb-[1.125rem]">
              <div className="min-w-0">
                <h2 id="cart-detail-title" className="text-[1.3125rem] font-semibold uppercase tracking-wide text-brand-navy/55">
                  Line details
                </h2>
                <p className="mt-1.5 text-[1.5946875rem] font-medium leading-snug text-brand-navy">
                  {detailItem.productName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailItemId(null)}
                className="shrink-0 rounded-lg border border-brand-navy/20 px-4 py-2 text-[1.125rem] font-semibold text-brand-navy transition hover:border-brand-orange hover:text-brand-orange"
              >
                Close
              </button>
            </div>
            <div className="pt-6">
              <CartLineDetailBody item={detailItem} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
