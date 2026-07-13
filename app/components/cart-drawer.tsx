"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";

import { CartIcon } from "@/app/components/icons";
import { removeCartItem, useCartItems, type CartItem } from "@/lib/cart";
import { productPathSegment } from "@/lib/product-path-slug";
import { resolveStorefrontImageUrl } from "@/lib/storefront-image-url";
import {
  storefrontCartNetProductSubtotalAfterVolumeAud,
  storefrontVolumeAdjustedCartLines,
} from "@/lib/storefront-volume-discount";

const CART_LINE_FALLBACK_IMAGE =
  "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=600&q=80";

const money = new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD" });

type CartDrawerProps = {
  open: boolean;
  onClose: () => void;
};

function lineImageSrc(item: CartItem): string {
  const raw = typeof item.imageUrl === "string" ? item.imageUrl.trim() : "";
  if (!raw) return CART_LINE_FALLBACK_IMAGE;
  return resolveStorefrontImageUrl(raw) || raw || CART_LINE_FALLBACK_IMAGE;
}

export function CartDrawer({ open, onClose }: CartDrawerProps) {
  const items = useCartItems();
  const count = items.reduce((sum, item) => sum + item.quantity, 0);

  const volumeAdjustedByLineId = useMemo(() => {
    const priced = storefrontVolumeAdjustedCartLines(
      items.map((it) => ({
        id: it.id,
        listUnitPrice: it.listUnitPrice ?? it.unitPrice,
        unitPrice: it.unitPrice,
        quantity: it.quantity,
        specialDealPackageId: it.specialDealPackageId,
        supplierName: it.supplierName,
        productName: it.productName,
        category: it.category,
      })),
    );
    return new Map(priced.map((row) => [String(row.id ?? ""), row]));
  }, [items]);

  const productSubtotal = useMemo(
    () => storefrontCartNetProductSubtotalAfterVolumeAud(items).net,
    [items],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  return (
    <div
      className={`fixed inset-0 z-[130] ${open ? "pointer-events-auto" : "pointer-events-none"}`}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={`absolute inset-0 z-0 bg-black/45 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0"
        }`}
        aria-label="Close cart"
        tabIndex={open ? 0 : -1}
        onClick={onClose}
      />
      <div
        id="store-cart-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
        className={`absolute bottom-0 right-0 top-0 z-10 flex w-[min(100vw-1.5rem,41.6rem)] flex-col bg-white shadow-2xl transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-brand-navy/10 px-6 py-[1.125rem] sm:px-[1.875rem]">
          <div className="flex min-w-0 items-center gap-3">
            <CartIcon className="h-[1.875rem] w-[1.875rem] shrink-0 text-brand-navy" />
            <p className="truncate text-[1.3125rem] font-semibold uppercase tracking-[0.08em] text-brand-navy">
              Cart{count > 0 ? ` · ${count}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-[1.125rem] py-[0.5625rem] text-[1.3125rem] font-semibold text-brand-navy transition hover:bg-brand-surface"
          >
            Close
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6 sm:px-[1.875rem]">
          {!items.length ? (
            <p className="rounded-xl border border-brand-navy/10 bg-brand-surface/50 px-6 py-9 text-center text-[1.3125rem] text-brand-navy/70">
              Your cart is empty.
            </p>
          ) : (
            <ul className="space-y-0 divide-y divide-brand-navy/10">
              {items.map((item) => {
                const priced = volumeAdjustedByLineId.get(item.id);
                const lineTotal = priced?.totalPrice ?? item.totalPrice;
                const unit =
                  priced?.unitPrice ??
                  (item.quantity > 0
                    ? Math.round((lineTotal / item.quantity) * 100) / 100
                    : item.unitPrice);
                const editHref = `/products/${encodeURIComponent(item.productPathSlug ?? productPathSegment({ name: item.productName, slug: null }))}?${new URLSearchParams({ cartEdit: item.id }).toString()}`;
                return (
                  <li key={item.id} className="flex gap-[1.125rem] py-6 first:pt-0">
                    <div className="relative h-[7.5rem] w-24 shrink-0 overflow-hidden rounded-xl bg-brand-surface/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={lineImageSrc(item)}
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain object-center"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[1.3125rem] font-medium leading-snug text-brand-navy">{item.productName}</p>
                      <p className="mt-1.5 text-[1.125rem] text-brand-navy/65">
                        {(item.size || "").trim() || "—"}
                        {(item.color || "").trim() ? ` · ${(item.color || "").trim()}` : ""}
                        {` · Qty ${item.quantity}`}
                      </p>
                      <p className="mt-1.5 text-[1.3125rem] tabular-nums text-brand-navy/80">
                        {money.format(unit)}
                        <span className="text-brand-navy/45"> · </span>
                        <span className="font-semibold text-brand-orange">{money.format(lineTotal)}</span>
                      </p>
                      <div className="mt-3 flex flex-wrap gap-3">
                        <Link
                          href={editHref}
                          onClick={onClose}
                          className="text-[1.125rem] font-semibold text-brand-orange hover:underline"
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.id)}
                          className="text-[1.125rem] font-semibold text-brand-navy/55 hover:text-red-700 hover:underline"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-brand-navy/10 bg-white px-6 py-6 sm:px-[1.875rem]">
          {items.length > 0 ? (
            <div className="mb-[1.125rem] flex items-baseline justify-between gap-[1.125rem] text-[1.3125rem]">
              <span className="font-medium text-brand-navy/70">Product subtotal</span>
              <span className="text-[1.5rem] font-semibold tabular-nums text-brand-navy">
                {money.format(productSubtotal)}
              </span>
            </div>
          ) : null}
          <p className="mb-[1.125rem] text-[1.05rem] leading-snug text-brand-navy/50">
            Delivery and logo setup fees are calculated on the full cart page before checkout.
          </p>
          <div className="flex flex-col gap-3">
            <Link
              href="/cart"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl bg-brand-orange px-6 py-[1.125rem] text-center text-[1.3125rem] font-semibold text-brand-navy transition hover:brightness-95"
            >
              {items.length ? "View cart & check out" : "View cart"}
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-brand-navy/20 bg-white px-6 py-[0.9375rem] text-[1.3125rem] font-semibold text-brand-navy transition hover:bg-brand-surface"
            >
              Continue shopping
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
