"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import { placeStoreOrder, type PlaceStoreOrderOptions } from "@/app/orders/actions";
import { ArrowLeftIcon } from "@/app/components/icons";
import { TopNav } from "@/app/components/top-nav";
import { extractAustralianPostcodeFromAddress } from "@/lib/customer-delivery-estimate";
import {
  STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD,
  cartHasEmbroideryLogoReferenceUploads,
  computeStorefrontCheckoutFees,
} from "@/lib/storefront-cart-checkout-fees";
import { storefrontCartNetProductSubtotalAfterVolumeAud } from "@/lib/storefront-volume-discount";
import { totalEstimatedShippingWeightKg } from "@/lib/delivery-shipping-weight";
import {
  clearCartItems,
  getCartItems,
  getReorderSourceStoreOrderId,
  subscribeCartUpdates,
  type CartItem,
} from "@/lib/cart";
import { STORE_MAIN_SHELL_CLASS } from "@/lib/store-main-shell";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

const CHECKOUT_REORDER_SOURCE_SESSION_KEY = "boss_web_checkout_reorder_source_order_id_v1";

/** Keep checkout readable without page-level zoom scaling. */
const PAYMENT_PAGE_ZOOM_WRAP_CLASS = "mx-auto w-full max-w-xl";

function toCurrency(amount: number) {
  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "AUD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getCookieValue(name: string) {
  if (typeof document === "undefined") return "";
  const key = `${name}=`;
  const found = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(key));
  return found ? decodeURIComponent(found.slice(key.length)) : "";
}

export default function PaymentPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  /** Read only after mount so SSR + first client paint match (cookies are not available on the server). */
  const [deliveryPostcode, setDeliveryPostcode] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [hasPriorEmbroideryOrder, setHasPriorEmbroideryOrder] = useState<boolean | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ orderNumber: string; trackUrl: string } | null>(null);
  const [payPending, startPayTransition] = useTransition();
  const [returningFromStripe, setReturningFromStripe] = useState(false);

  useEffect(() => {
    const sync = () => setItems(getCartItems());
    sync();
    const addr = getCookieValue("customer_delivery_address");
    setDeliveryAddress(addr);
    setDeliveryPostcode(extractAustralianPostcodeFromAddress(addr));
    return subscribeCartUpdates(sync);
  }, []);

  useEffect(() => {
    const email = getCookieValue("customer_email").trim();
    if (!email) {
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
        const data = (await res.json()) as { hasPriorEmbroideryOrder?: boolean };
        if (!cancelled) setHasPriorEmbroideryOrder(Boolean(data.hasPriorEmbroideryOrder));
      } catch {
        if (!cancelled) setHasPriorEmbroideryOrder(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const productNetSubtotal = useMemo(
    () => storefrontCartNetProductSubtotalAfterVolumeAud(items).net,
    [items],
  );
  const estimatedWeightKg = useMemo(() => totalEstimatedShippingWeightKg(items), [items]);
  const checkoutFees = useMemo(
    () =>
      computeStorefrontCheckoutFees({
        subtotalAud: productNetSubtotal,
        items,
        deliveryPostcode,
        estimatedWeightKg,
        isCustomerSignedIn: true,
        hasPriorEmbroideryOrder,
      }),
    [productNetSubtotal, items, deliveryPostcode, estimatedWeightKg, hasPriorEmbroideryOrder],
  );
  const { deliveryFeeAud: deliveryFee, logoSetupFeeAud: logoSetupFee, totalAud: payableTotal } = checkoutFees;

  const needsEmbroideryHistoryBeforePay = useMemo(() => {
    if (items.length === 0) return false;
    const hasEmb = items.some((i) => (i.serviceType ?? "").toLowerCase().includes("embroidery"));
    if (!hasEmb) return false;
    const newLogoOnEmbroidery = cartHasEmbroideryLogoReferenceUploads(items);
    if (productNetSubtotal >= STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD && !newLogoOnEmbroidery) return false;
    return true;
  }, [items, productNetSubtotal]);

  const payBlockedPendingEmbroideryHistory =
    needsEmbroideryHistoryBeforePay && hasPriorEmbroideryOrder === null;

  async function startStripeCheckout() {
    setPayError(null);
    if (items.length === 0) {
      setPayError("Your cart is empty.");
      return;
    }
    startPayTransition(async () => {
      try {
        // Persist checkout snapshot so a redirect away to Stripe doesn't lose cart state.
        try {
          sessionStorage.setItem("boss_web_checkout_cart_v1", JSON.stringify(items));
          sessionStorage.setItem("boss_web_checkout_delivery_address_v1", deliveryAddress);
          const reorderSrc = getReorderSourceStoreOrderId();
          if (reorderSrc) {
            sessionStorage.setItem(CHECKOUT_REORDER_SOURCE_SESSION_KEY, reorderSrc);
          } else {
            sessionStorage.removeItem(CHECKOUT_REORDER_SOURCE_SESSION_KEY);
          }
        } catch {
          // ignore storage failures (private mode, etc)
        }
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: items.map((i) => ({
              productName: i.productName,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.totalPrice,
              ...(typeof i.listUnitPrice === "number" && Number.isFinite(i.listUnitPrice)
                ? { listUnitPrice: i.listUnitPrice }
                : {}),
              serviceType: i.serviceType,
              ...(i.category != null && String(i.category).trim() !== ""
                ? { category: String(i.category).trim() }
                : {}),
              ...(Array.isArray(i.referenceImageUrls) && i.referenceImageUrls.length > 0
                ? { referenceImageUrls: i.referenceImageUrls }
                : {}),
            })),
            deliveryAddress,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; error?: string; hint?: string };
        if (!res.ok || !json.ok || !json.url) {
          setPayError(json.hint ? `${json.error || "Could not start checkout."} ${json.hint}` : json.error || "Could not start checkout.");
          return;
        }
        window.location.href = json.url;
      } catch (e) {
        setPayError(e instanceof Error ? e.message : "Could not start checkout.");
      }
    });
  }

  // When Stripe redirects back, store the order (server-side) using the same cart lines.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    const status = sp.get("status") ?? "";
    const sessionId = sp.get("session_id") ?? "";
    if (status !== "stripe_success" || !sessionId || placed || payPending) {
      return;
    }
    setReturningFromStripe(true);
    setPayError(null);
    // Stripe redirect can happen after the cart was modified/cleared; prefer the saved snapshot if present.
    let payloadItems = items;
    if (!Array.isArray(payloadItems) || payloadItems.length === 0) {
      try {
        const raw = sessionStorage.getItem("boss_web_checkout_cart_v1");
        const parsed = raw ? (JSON.parse(raw) as unknown) : null;
        if (Array.isArray(parsed)) {
          payloadItems = parsed as CartItem[];
        }
      } catch {
        // ignore
      }
    }
    startPayTransition(async () => {
      let placeOpts: PlaceStoreOrderOptions | undefined;
      try {
        const rs = sessionStorage.getItem(CHECKOUT_REORDER_SOURCE_SESSION_KEY)?.trim();
        if (rs && /^[0-9a-f-]{36}$/i.test(rs)) {
          placeOpts = { reorderedFromStoreOrderId: rs };
        }
      } catch {
        // ignore
      }
      const res = await placeStoreOrder(payloadItems, placeOpts);
      if (res.ok) {
        clearCartItems();
        setItems([]);
        setPlaced({ orderNumber: res.orderNumber, trackUrl: res.trackUrl });
        try {
          sessionStorage.removeItem("boss_web_checkout_cart_v1");
          sessionStorage.removeItem("boss_web_checkout_delivery_address_v1");
          sessionStorage.removeItem(CHECKOUT_REORDER_SOURCE_SESSION_KEY);
        } catch {
          // ignore
        }
      } else {
        setPayError(res.error);
      }
      setReturningFromStripe(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  if (placed) {
    return (
      <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
        <TopNav />
        <div className={STORE_MAIN_SHELL_CLASS}>
          <section className={`${SITE_PAGE_ROW_CLASS} py-10`}>
            <div className={`${PAYMENT_PAGE_ZOOM_WRAP_CLASS} space-y-6 text-base`}>
              <header className="space-y-2">
                <h1 className="text-[2.925rem] font-medium leading-tight">Your order is completed</h1>
                <p className="text-brand-navy/70">
                  Thanks for your shopping. Your order ID{" "}
                  <span className="font-mono font-semibold">{placed.orderNumber}</span> is confirmed. We will email you a receipt and link.
                </p>
              </header>
              <div className="rounded-2xl border border-brand-navy/15 bg-brand-surface/50 p-5">
                <p className="font-medium text-brand-navy">Delivery tracking</p>
                <p className="mt-2 text-brand-navy/80">
                  Save this page — you can check status and tracking any time:
                </p>
                <Link
                  href={placed.trackUrl}
                  className="mt-3 inline-block font-semibold text-brand-orange underline hover:text-brand-orange/90"
                >
                  View order &amp; tracking
                </Link>
              </div>
              <Link href="/" className="inline-block font-semibold text-brand-navy hover:text-brand-orange">
                Continue shopping
              </Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
      <TopNav />
      <div className={STORE_MAIN_SHELL_CLASS}>
        <section className={`${SITE_PAGE_ROW_CLASS} py-10`}>
        <div className={PAYMENT_PAGE_ZOOM_WRAP_CLASS}>
        <header className="mb-7 space-y-2">
          <Link href="/cart" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-orange">
            <ArrowLeftIcon className="h-4 w-4" />
            Back to cart
          </Link>
          <h1 className="text-4xl font-medium">Payment</h1>
          <p className="text-sm text-brand-navy/70">
            Complete your payment details to place the order.
          </p>
        </header>

        <div className="mb-6 rounded-2xl border border-brand-navy/15 bg-brand-surface/50 p-5">
          <h2 className="text-sm font-medium uppercase tracking-[0.1em] text-brand-navy/70">Order total</h2>
          <p className="mt-2 text-xs leading-snug text-brand-navy/60">
            Logo setup (60 + GST) applies to your <strong>first</strong> embroidery order under{" "}
            {toCurrency(STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD)} subtotal, and again whenever an embroidery line
            includes <strong>new logo files</strong> you upload. At or above{" "}
            {toCurrency(STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD)} subtotal: logo setup is waived; Perth Metro (6000–6199)
            delivery free.
          </p>
          <div className="mt-3 space-y-1 text-sm">
            <p className="flex justify-between">
              <span>Products</span>
              <span className="font-semibold">{toCurrency(grandTotal)}</span>
            </p>
            <p className="flex justify-between">
              <span>Logo setup</span>
              <span className="font-semibold">
                {!items.some((i) => (i.serviceType ?? "").toLowerCase().includes("embroidery"))
                  ? "—"
                  : hasPriorEmbroideryOrder === null
                    ? "…"
                    : logoSetupFee === 0
                      ? "Waived"
                      : toCurrency(logoSetupFee)}
              </span>
            </p>
            <p className="flex justify-between">
              <span>Delivery</span>
              <span className="font-semibold">
                {deliveryPostcode ? (deliveryFee === 0 ? "Free" : toCurrency(deliveryFee)) : "—"}
              </span>
            </p>
            <p className="text-xs leading-snug text-brand-navy/55">
              Chargeable weight estimate: max (packed weight, cubic weight) per line, by product type.
            </p>
          </div>
          <p className="mt-4 flex items-center justify-between border-t border-brand-navy/10 pt-4">
            <span className="text-base font-medium">Total payable</span>
            <span className="text-2xl font-medium text-brand-orange">{toCurrency(payableTotal)}</span>
          </p>
        </div>

        <div className="grid gap-4 rounded-2xl border border-brand-navy/15 p-5">
          <p className="text-sm text-brand-navy/70">
            Card details are collected securely by our payment provider (Stripe). You will be redirected to complete payment.
          </p>
          {returningFromStripe ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Payment received — finalising your order…
            </p>
          ) : null}
          {payError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{payError}</p>
          ) : null}
          <button
            type="button"
            disabled={payPending || items.length === 0 || payBlockedPendingEmbroideryHistory}
            onClick={() => void startStripeCheckout()}
            className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-brand-orange px-4 py-2.5 text-base font-medium text-brand-navy transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {payPending ? "Redirecting…" : payBlockedPendingEmbroideryHistory ? "Loading pricing…" : "Pay with card"}
          </button>
          {items.length === 0 ? (
            <Link href="/cart" className="text-sm font-semibold text-brand-orange hover:underline">
              Back to cart
            </Link>
          ) : null}
        </div>
        </div>
        </section>
      </div>
    </main>
  );
}
