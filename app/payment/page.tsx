"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";

import eftposMark from "../../public/eftpos.png";

import { placeStoreOrder } from "@/app/orders/actions";
import { ArrowLeftIcon } from "@/app/components/icons";
import { TopNav } from "@/app/components/top-nav";
import {
  calculateDeliveryFee,
  distanceKmFromCompanyBase,
  extractAustralianPostcodeFromAddress,
} from "@/lib/customer-delivery-estimate";
import { clearCartItems, getCartItems, subscribeCartUpdates, type CartItem } from "@/lib/cart";
import { STORE_MAIN_SHELL_CLASS } from "@/lib/store-main-shell";
import { SITE_PAGE_ROW_CLASS } from "@/lib/site-layout";

function toCurrency(amount: number) {
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
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
  const [payError, setPayError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ orderNumber: string; trackUrl: string } | null>(null);
  const [payPending, startPayTransition] = useTransition();

  useEffect(() => {
    const sync = () => setItems(getCartItems());
    sync();
    setDeliveryPostcode(extractAustralianPostcodeFromAddress(getCookieValue("customer_delivery_address")));
    return subscribeCartUpdates(sync);
  }, []);

  const grandTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.totalPrice, 0),
    [items]
  );
  const estimatedWeightKg = useMemo(
    () => Number(items.reduce((sum, item) => sum + item.quantity * 0.35, 0).toFixed(2)),
    [items]
  );
  const distanceKm = useMemo(() => distanceKmFromCompanyBase(deliveryPostcode), [deliveryPostcode]);
  const deliveryFee = useMemo(
    () => calculateDeliveryFee(distanceKm, estimatedWeightKg),
    [distanceKm, estimatedWeightKg]
  );
  const payableTotal = grandTotal + deliveryFee;

  function handlePay() {
    setPayError(null);
    if (items.length === 0) {
      setPayError("Your cart is empty.");
      return;
    }
    startPayTransition(async () => {
      const res = await placeStoreOrder(items);
      if (res.ok) {
        clearCartItems();
        setItems([]);
        setPlaced({ orderNumber: res.orderNumber, trackUrl: res.trackUrl });
      } else {
        setPayError(res.error);
      }
    });
  }

  if (placed) {
    return (
      <main className="min-h-screen bg-white pt-[var(--site-header-height)] text-brand-navy">
        <TopNav />
        <div className={STORE_MAIN_SHELL_CLASS}>
          <section className={`${SITE_PAGE_ROW_CLASS} py-10`}>
            <div className="mx-auto w-full max-w-xl space-y-6 text-[1.1375rem]">
              <header className="space-y-2">
                <h1 className="text-[2.925rem] font-medium leading-tight">Payment received</h1>
                <p className="text-brand-navy/70">
                  Customer order ID{" "}
                  <span className="font-mono font-semibold">{placed.orderNumber}</span> is confirmed. Use it for
                  invoices and tracking. We will email you a receipt and link.
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
        <div className="mx-auto w-full max-w-xl">
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
          <div className="mt-3 space-y-1 text-sm">
            <p className="flex justify-between">
              <span>Products</span>
              <span className="font-semibold">{toCurrency(grandTotal)}</span>
            </p>
            <p className="flex justify-between">
              <span>Delivery</span>
              <span className="font-semibold">
                {deliveryPostcode ? (deliveryFee === 0 ? "Free" : toCurrency(deliveryFee)) : "—"}
              </span>
            </p>
          </div>
          <p className="mt-4 flex items-center justify-between border-t border-brand-navy/10 pt-4">
            <span className="text-base font-medium">Total payable</span>
            <span className="text-2xl font-medium text-brand-orange">{toCurrency(payableTotal)}</span>
          </p>
        </div>

        <form className="grid gap-4 rounded-2xl border border-brand-navy/15 p-5">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-md bg-white px-3 py-1.5">
              <img src="/visa.png" alt="VISA" className="h-9 w-auto" />
            </span>
            <span className="inline-flex items-center rounded-md bg-white px-3 py-1.5">
              <img src="/mastercard.png" alt="Mastercard" className="h-9 w-auto" />
            </span>
            <span className="inline-flex items-center rounded-md bg-white px-3 py-1.5">
              <Image src={eftposMark} alt="Eftpos" width={146} height={94} className="h-9 w-auto" />
            </span>
          </div>

          <div className="grid gap-2">
            <label htmlFor="card_name" className="text-sm font-semibold">
              Name on Card
            </label>
            <input
              id="card_name"
              name="card_name"
              className="rounded-md border border-brand-navy/20 px-3 py-1.5"
              placeholder="John Doe"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="card_number" className="text-sm font-semibold">
              Card Number
            </label>
            <input
              id="card_number"
              name="card_number"
              className="rounded-md border border-brand-navy/20 px-3 py-1.5"
              placeholder="1234 5678 9012 3456"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <label htmlFor="expiry" className="text-sm font-semibold">
                Expiry Date
              </label>
              <input
                id="expiry"
                name="expiry"
                className="rounded-md border border-brand-navy/20 px-3 py-1.5"
                placeholder="MM/YY"
              />
            </div>
            <div className="grid gap-2">
              <label htmlFor="cvv" className="text-sm font-semibold">
                CVV
              </label>
              <input
                id="cvv"
                name="cvv"
                className="rounded-md border border-brand-navy/20 px-3 py-1.5"
                placeholder="123"
              />
            </div>
          </div>

          {payError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{payError}</p>
          ) : null}
          <button
            type="button"
            disabled={payPending || items.length === 0}
            onClick={() => handlePay()}
            className="mt-2 inline-flex w-full items-center justify-center rounded-xl bg-brand-orange px-4 py-2.5 text-base font-medium text-brand-navy transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {payPending ? "Processing…" : "Pay now"}
          </button>
        </form>
        </div>
        </section>
      </div>
    </main>
  );
}
