"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";

import { PurchaseAnalyticsTracker } from "@/app/components/purchase-analytics-tracker";
import { placeStoreOrder, type PlaceStoreOrderOptions } from "@/app/orders/actions";
import { ArrowLeftIcon } from "@/app/components/icons";
import { TopNav } from "@/app/components/top-nav";
import { cartItemsToStoreOrderLines } from "@/lib/cart-to-store-order-line";
import { extractAustralianPostcodeFromAddress } from "@/lib/customer-delivery-estimate";
import {
  CHECKOUT_PICK_UP_SESSION_KEY,
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
import { parseStoredJsonOrNull, readResponseJson } from "@/lib/safe-json-parse";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

const CHECKOUT_REORDER_SOURCE_SESSION_KEY = "boss_web_checkout_reorder_source_order_id_v1";
const CHECKOUT_PROMO_SESSION_KEY = "boss_web_checkout_promo_v1";

type AppliedPromo = {
  promotionCodeId: string;
  code: string;
  discountAud: number;
  description: string | null;
};

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
  const router = useRouter();
  const [items, setItems] = useState<CartItem[]>([]);
  /** Read only after mount so SSR + first client paint match (cookies are not available on the server). */
  const [deliveryPostcode, setDeliveryPostcode] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState<string>("");
  const [hasPriorEmbroideryOrder, setHasPriorEmbroideryOrder] = useState<boolean | null>(null);
  const [payError, setPayError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{
    orderNumber: string;
    trackUrl: string;
    valueAud?: number;
    itemCount?: number;
  } | null>(null);
  const [payPending, startPayTransition] = useTransition();
  const [returningFromStripe, setReturningFromStripe] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<AppliedPromo | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promoPending, setPromoPending] = useState(false);
  const [pickUp, setPickUp] = useState(false);
  const [storeCreditBalanceCents, setStoreCreditBalanceCents] = useState(0);

  useEffect(() => {
    const sync = () => setItems(getCartItems());
    sync();
    const addr = getCookieValue("customer_delivery_address");
    setDeliveryAddress(addr);
    setDeliveryPostcode(extractAustralianPostcodeFromAddress(addr));
    try {
      setPickUp(sessionStorage.getItem(CHECKOUT_PICK_UP_SESSION_KEY) === "1");
    } catch {
      setPickUp(false);
    }
    const parsed = parseStoredJsonOrNull(sessionStorage.getItem(CHECKOUT_PROMO_SESSION_KEY)) as AppliedPromo | null;
    if (parsed?.promotionCodeId && parsed.code && Number.isFinite(parsed.discountAud)) {
      setAppliedPromo(parsed);
      setPromoInput(parsed.code);
    }
    return subscribeCartUpdates(sync);
  }, []);

  useEffect(() => {
    const email = getCookieValue("customer_email").trim();
    if (!email) {
      setStoreCreditBalanceCents(0);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/customer/store-credit", { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setStoreCreditBalanceCents(0);
          return;
        }
        const data = await readResponseJson<{ ok?: boolean; balanceCents?: number }>(res);
        if (!cancelled) setStoreCreditBalanceCents(Math.max(0, data?.balanceCents ?? 0));
      } catch {
        if (!cancelled) setStoreCreditBalanceCents(0);
      }
    })();
    return () => {
      cancelled = true;
    };
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
        const data = await readResponseJson<{ hasPriorEmbroideryOrder?: boolean }>(res);
        if (!cancelled) setHasPriorEmbroideryOrder(Boolean(data?.hasPriorEmbroideryOrder));
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
        pickUp,
      }),
    [productNetSubtotal, items, deliveryPostcode, estimatedWeightKg, hasPriorEmbroideryOrder, pickUp],
  );
  const { deliveryFeeAud: deliveryFee, logoSetupFeeAud: logoSetupFee, totalAud: checkoutTotal } = checkoutFees;
  const promoDiscount = appliedPromo?.discountAud ?? 0;
  const payableBeforeCredit = Math.max(0, checkoutTotal - promoDiscount);
  const storeCreditAppliedAud = Math.min(storeCreditBalanceCents / 100, payableBeforeCredit);
  const payableTotal = Math.max(0, payableBeforeCredit - storeCreditAppliedAud);
  const creditCoversAll = payableTotal <= 0 && storeCreditAppliedAud > 0;

  useEffect(() => {
    if (!appliedPromo || items.length === 0) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/storefront/promo/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            code: appliedPromo.code,
            productSubtotalAud: productNetSubtotal,
            logoSetupFeeAud: logoSetupFee,
          }),
        });
        const data = await readResponseJson<{
          ok?: boolean;
          promotionCodeId?: string;
          code?: string;
          discountAud?: number;
          description?: string | null;
          error?: string;
        }>(res);
        if (cancelled) return;
        if (!res.ok || !data?.ok || !data.promotionCodeId) {
          setAppliedPromo(null);
          setPromoError(data?.error ?? "Discount code no longer applies to this order.");
          try {
            sessionStorage.removeItem(CHECKOUT_PROMO_SESSION_KEY);
          } catch {
            // ignore
          }
          return;
        }
        const next: AppliedPromo = {
          promotionCodeId: data.promotionCodeId,
          code: data.code ?? appliedPromo.code,
          discountAud: data.discountAud ?? 0,
          description: data.description ?? null,
        };
        setAppliedPromo(next);
        try {
          sessionStorage.setItem(CHECKOUT_PROMO_SESSION_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
      } catch {
        if (!cancelled) setPromoError("Could not refresh discount code.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [appliedPromo?.code, productNetSubtotal, logoSetupFee, items.length]);

  async function applyPromoCode() {
    setPromoError(null);
    const code = promoInput.trim();
    if (!code) {
      setPromoError("Enter a discount code.");
      return;
    }
    setPromoPending(true);
    try {
      const res = await fetch("/api/storefront/promo/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code, productSubtotalAud: productNetSubtotal, logoSetupFeeAud: logoSetupFee }),
      });
      const data = await readResponseJson<{
        ok?: boolean;
        promotionCodeId?: string;
        code?: string;
        discountAud?: number;
        description?: string | null;
        error?: string;
      }>(res);
      if (!res.ok || !data?.ok || !data.promotionCodeId) {
        setAppliedPromo(null);
        setPromoError(data?.error ?? "Invalid discount code.");
        try {
          sessionStorage.removeItem(CHECKOUT_PROMO_SESSION_KEY);
        } catch {
          // ignore
        }
        return;
      }
      const next: AppliedPromo = {
        promotionCodeId: data.promotionCodeId,
        code: data.code ?? code,
        discountAud: data.discountAud ?? 0,
        description: data.description ?? null,
      };
      setAppliedPromo(next);
      setPromoInput(next.code);
      try {
        sessionStorage.setItem(CHECKOUT_PROMO_SESSION_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
    } catch {
      setPromoError("Could not apply discount code.");
    } finally {
      setPromoPending(false);
    }
  }

  function removePromoCode() {
    setAppliedPromo(null);
    setPromoInput("");
    setPromoError(null);
    try {
      sessionStorage.removeItem(CHECKOUT_PROMO_SESSION_KEY);
    } catch {
      // ignore
    }
  }

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
          if (appliedPromo) {
            sessionStorage.setItem(CHECKOUT_PROMO_SESSION_KEY, JSON.stringify(appliedPromo));
          }
          if (pickUp) {
            sessionStorage.setItem(CHECKOUT_PICK_UP_SESSION_KEY, "1");
          } else {
            sessionStorage.removeItem(CHECKOUT_PICK_UP_SESSION_KEY);
          }
        } catch {
          // ignore storage failures (private mode, etc)
        }
        const res = await fetch("/api/stripe/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            items: cartItemsToStoreOrderLines(items),
            deliveryAddress,
            applyStoreCredit: true,
            ...(appliedPromo ? { promotionCodeId: appliedPromo.promotionCodeId } : {}),
            ...(pickUp ? { pickUp: true } : {}),
            ...(getReorderSourceStoreOrderId()
              ? { reorderedFromStoreOrderId: getReorderSourceStoreOrderId()! }
              : {}),
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          url?: string;
          error?: string;
          hint?: string;
          creditOnly?: boolean;
          storeCreditAppliedCents?: number;
        };
        if (!res.ok || !json.ok) {
          setPayError(
            json.hint
              ? `${json.error || "Could not start checkout."} ${json.hint}`
              : json.error || "Could not start checkout.",
          );
          return;
        }
        if (json.creditOnly && json.storeCreditAppliedCents) {
          const orderRes = await placeStoreOrder(cartItemsToStoreOrderLines(items), {
            ...(appliedPromo ? { promotionCodeId: appliedPromo.promotionCodeId } : {}),
            ...(pickUp ? { pickUp: true } : {}),
            ...(getReorderSourceStoreOrderId()
              ? { reorderedFromStoreOrderId: getReorderSourceStoreOrderId()! }
              : {}),
            applyStoreCredit: true,
            storeCreditAppliedCents: json.storeCreditAppliedCents,
          });
          if (!orderRes.ok) {
            setPayError(orderRes.error);
            return;
          }
          clearCartItems();
          try {
            sessionStorage.removeItem(CHECKOUT_PROMO_SESSION_KEY);
            sessionStorage.removeItem(CHECKOUT_PICK_UP_SESSION_KEY);
            sessionStorage.removeItem(CHECKOUT_REORDER_SOURCE_SESSION_KEY);
          } catch {
            // ignore
          }
          setPlaced({
            orderNumber: orderRes.orderNumber,
            trackUrl: orderRes.trackUrl,
            valueAud: payableBeforeCredit,
            itemCount: items.reduce((s, i) => s + i.quantity, 0),
          });
          return;
        }
        if (!json.url) {
          setPayError("Could not start checkout.");
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
        const parsed = parseStoredJsonOrNull(sessionStorage.getItem("boss_web_checkout_cart_v1"));
        if (Array.isArray(parsed)) {
          payloadItems = parsed as CartItem[];
        }
      } catch {
        // ignore
      }
    }
    // Stripe only redirects here after a successful payment, so empty the cart now regardless of how the
    // order is finalised (client call below or the Stripe webhook). The order payload uses payloadItems /
    // the sessionStorage snapshot, which are unaffected by clearing the live cart.
    clearCartItems();
    setItems([]);
    startPayTransition(async () => {
      let placeOpts: PlaceStoreOrderOptions | undefined;
      try {
        const rs = sessionStorage.getItem(CHECKOUT_REORDER_SOURCE_SESSION_KEY)?.trim();
        const parsed = parseStoredJsonOrNull(sessionStorage.getItem(CHECKOUT_PROMO_SESSION_KEY)) as {
          promotionCodeId?: string;
        } | null;
        let promotionCodeId: string | undefined;
        if (parsed?.promotionCodeId && /^[0-9a-f-]{36}$/i.test(parsed.promotionCodeId)) {
          promotionCodeId = parsed.promotionCodeId;
        }
        const pickUpStored = sessionStorage.getItem(CHECKOUT_PICK_UP_SESSION_KEY) === "1";
        const stripeOpts = {
          ...(promotionCodeId ? { promotionCodeId } : {}),
          ...(pickUpStored ? { pickUp: true } : {}),
          ...(sessionId.startsWith("cs_") ? { stripeCheckoutSessionId: sessionId } : {}),
        };
        if (rs && /^[0-9a-f-]{36}$/i.test(rs)) {
          placeOpts = { reorderedFromStoreOrderId: rs, ...stripeOpts };
        } else if (Object.keys(stripeOpts).length > 0) {
          placeOpts = stripeOpts;
        }
      } catch {
        // ignore
      }
      if (!placeOpts && sessionId.startsWith("cs_")) {
        placeOpts = { stripeCheckoutSessionId: sessionId };
      }
      const res = await placeStoreOrder(cartItemsToStoreOrderLines(payloadItems), placeOpts);
      if (res.ok) {
        const itemCount = payloadItems.reduce((sum, line) => sum + Math.max(1, line.quantity ?? 1), 0);
        clearCartItems();
        setItems([]);
        setPlaced({
          orderNumber: res.orderNumber,
          trackUrl: res.trackUrl,
          valueAud: payableTotal,
          itemCount,
        });
        try {
          sessionStorage.removeItem("boss_web_checkout_cart_v1");
          sessionStorage.removeItem("boss_web_checkout_delivery_address_v1");
          sessionStorage.removeItem(CHECKOUT_REORDER_SOURCE_SESSION_KEY);
          sessionStorage.removeItem(CHECKOUT_PROMO_SESSION_KEY);
          sessionStorage.removeItem(CHECKOUT_PICK_UP_SESSION_KEY);
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

  // After a successful order, send the customer to their My account page instead of a standalone receipt.
  useEffect(() => {
    if (!placed) {
      return;
    }
    router.replace(`/customer?placed=${encodeURIComponent(placed.orderNumber)}`);
  }, [placed, router]);

  if (placed) {
    return (
      <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
        <PurchaseAnalyticsTracker
          orderNumber={placed.orderNumber}
          valueAud={placed.valueAud}
          itemCount={placed.itemCount}
        />
        <TopNav />
        <div className={STORE_MAIN_SHELL_CLASS}>
          <section className={`${SITE_PAGE_ROW_CLASS} py-10`}>
            <div className={`${PAYMENT_PAGE_ZOOM_WRAP_CLASS} space-y-4 text-base`}>
              <h1 className="text-[2.25rem] font-medium leading-tight">Order confirmed</h1>
              <p className="text-brand-navy/70">
                Thanks for your shopping. Your order ID{" "}
                <span className="font-mono font-semibold">{placed.orderNumber}</span> is confirmed — taking you to your
                account…
              </p>
              <Link
                href={`/customer?placed=${encodeURIComponent(placed.orderNumber)}`}
                className="inline-block font-semibold text-brand-orange underline hover:text-brand-orange/90"
              >
                Go to My account
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
            {toCurrency(STOREFRONT_CART_PROMO_SUBTOTAL_MIN_AUD)} subtotal: logo setup is waived. Delivery fees apply
            Australia-wide based on postcode and chargeable weight.
          </p>
          <div className="mt-3 space-y-1 text-sm">
            <p className="flex justify-between">
              <span>Products</span>
              <span className="font-semibold">{toCurrency(productNetSubtotal)}</span>
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
                {pickUp
                  ? "Pick up"
                  : deliveryPostcode
                    ? deliveryFee === 0
                      ? "Free"
                      : toCurrency(deliveryFee)
                    : "—"}
              </span>
            </p>
            {appliedPromo && promoDiscount > 0 ? (
              <p className="flex justify-between text-emerald-800">
                <span>
                  Discount ({appliedPromo.code})
                  {appliedPromo.description ? (
                    <span className="block text-xs font-normal text-emerald-700/80">{appliedPromo.description}</span>
                  ) : null}
                </span>
                <span className="font-semibold">−{toCurrency(promoDiscount)}</span>
              </p>
            ) : null}
            {storeCreditAppliedAud > 0 ? (
              <p className="flex justify-between text-emerald-800">
                <span>
                  Store credit
                  <span className="block text-xs font-normal text-emerald-700/80">
                    Applied automatically (balance {toCurrency(storeCreditBalanceCents / 100)})
                  </span>
                </span>
                <span className="font-semibold">−{toCurrency(storeCreditAppliedAud)}</span>
              </p>
            ) : null}
            <p className="text-xs leading-snug text-brand-navy/55">
              Chargeable weight estimate: max (packed weight, cubic weight) per line, by product type.
            </p>
          </div>
          <p className="mt-4 flex items-center justify-between border-t border-brand-navy/10 pt-4">
            <span className="text-base font-medium">Total payable</span>
            <span className="text-2xl font-medium text-brand-orange">{toCurrency(payableTotal)}</span>
          </p>
          <div className="mt-4 border-t border-brand-navy/10 pt-4">
            <p className="text-xs font-medium uppercase tracking-[0.1em] text-brand-navy/70">Discount code</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <input
                type="text"
                value={promoInput}
                onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                placeholder="Enter code"
                autoComplete="off"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-brand-navy/20 px-3 py-2 text-sm uppercase focus:border-brand-orange focus:outline-none focus:ring-1 focus:ring-brand-orange"
              />
              {appliedPromo ? (
                <button
                  type="button"
                  onClick={removePromoCode}
                  className="rounded-lg border border-brand-navy/20 px-3 py-2 text-sm font-semibold text-brand-navy hover:bg-brand-surface/80"
                >
                  Remove
                </button>
              ) : (
                <button
                  type="button"
                  disabled={promoPending || items.length === 0}
                  onClick={() => void applyPromoCode()}
                  className="rounded-lg bg-brand-navy px-3 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  {promoPending ? "Applying…" : "Apply"}
                </button>
              )}
            </div>
            {promoError ? <p className="mt-2 text-sm text-red-700">{promoError}</p> : null}
            {appliedPromo && !promoError ? (
              <p className="mt-2 text-sm text-emerald-800">
                Code <span className="font-mono font-semibold">{appliedPromo.code}</span> applied.
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 rounded-2xl border border-brand-navy/15 p-5">
          <p className="text-sm text-brand-navy/70">
            {creditCoversAll
              ? "Your store credit covers this order — no card payment needed."
              : "Card details are collected securely by our payment provider (Stripe). You will be redirected to complete payment."}
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
            {payPending
              ? creditCoversAll
                ? "Placing order…"
                : "Redirecting…"
              : payBlockedPendingEmbroideryHistory
                ? "Loading pricing…"
                : creditCoversAll
                  ? "Place order with store credit"
                  : "Pay with card"}
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
