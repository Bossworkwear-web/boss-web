"use client";

import { useSyncExternalStore } from "react";

export type CartItem = {
  id: string;
  productId: string;
  /** From `products.supplier_name` when adding from catalog. */
  supplierName?: string;
  /** Segment for `/products/[slug]` — set when adding from the product page. */
  productPathSlug?: string;
  /** First product image URL for cart thumbnails. */
  imageUrl?: string;
  productName: string;
  /** From `products.category` when adding from catalog (optional on legacy localStorage lines). */
  category?: string | null;
  serviceType: string;
  color: string;
  size: string;
  quantity: number;
  placements: string[];
  /** Pre–volume-discount unit (incl. placements). Optional on legacy lines; defaults to `unitPrice`. */
  listUnitPrice?: number;
  unitPrice: number;
  totalPrice: number;
  addedAt: string;
  /** Customer requirements / specials from product page NOTE field */
  notes?: string;
  /** Public Supabase Storage URLs for customer reference images (same line as logos). */
  referenceImageUrls?: string[];
  /** Fixed package from Special Deals (`storefront-special-deal-packages`). */
  specialDealPackageId?: string;
};

const CART_STORAGE_KEY = "boss_web_cart_items";
/** Public mockup image URLs from last My account → Reorder (`click_up_sheet_images.is_mockup`). */
const CART_REORDER_MOCKUPS_KEY = "boss_web_cart_reorder_mockups";
/** `store_orders.id` of the order used for Reorder — passed through checkout into `store_orders.reordered_from_store_order_id`. */
const CART_REORDER_SOURCE_ORDER_ID_KEY = "boss_web_cart_reorder_source_order_id";
const CART_UPDATED_EVENT = "boss-web-cart-updated";

function clearReorderMockupsFromStorage() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(CART_REORDER_MOCKUPS_KEY);
}

function clearReorderSourceOrderIdFromStorage() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(CART_REORDER_SOURCE_ORDER_ID_KEY);
}

function clearReorderMetaFromStorage() {
  clearReorderMockupsFromStorage();
  clearReorderSourceOrderIdFromStorage();
}

/** Prior order UUID from last Reorder (must match `store_orders.id`). */
export function getReorderSourceStoreOrderId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  const raw = window.localStorage.getItem(CART_REORDER_SOURCE_ORDER_ID_KEY);
  const id = (raw ?? "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return null;
  }
  return id;
}

export function getReorderMockupImageUrls(): string[] {
  if (typeof window === "undefined") {
    return [];
  }
  const raw = window.localStorage.getItem(CART_REORDER_MOCKUPS_KEY);
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter((u): u is string => typeof u === "string" && u.trim().length > 0).map((u) => u.trim());
  } catch {
    return [];
  }
}

function safeParse(value: string | null): CartItem[] {
  if (!value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as CartItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function emitCartUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CART_UPDATED_EVENT));
  }
}

export function getCartItems(): CartItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  return safeParse(window.localStorage.getItem(CART_STORAGE_KEY));
}

export function getCartCount(): number {
  return getCartItems().reduce((sum, item) => sum + item.quantity, 0);
}

export function addCartItem(item: Omit<CartItem, "id" | "addedAt">) {
  if (typeof window === "undefined") {
    return;
  }

  clearReorderMetaFromStorage();
  const items = getCartItems();
  const nextItem: CartItem = {
    ...item,
    id: crypto.randomUUID(),
    addedAt: new Date().toISOString(),
  };
  items.push(nextItem);

  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  emitCartUpdated();
}

/** Replace an existing line (same `id` and `addedAt`) — e.g. Edit from cart. */
export function updateCartItem(itemId: string, updates: Omit<CartItem, "id" | "addedAt">): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  clearReorderMetaFromStorage();
  const items = getCartItems();
  const idx = items.findIndex((row) => row.id === itemId);
  if (idx === -1) {
    return false;
  }
  const prev = items[idx];
  items[idx] = {
    ...updates,
    id: prev.id,
    addedAt: prev.addedAt,
  };
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  emitCartUpdated();
  return true;
}

export function removeCartItem(itemId: string) {
  if (typeof window === "undefined") {
    return;
  }
  clearReorderMetaFromStorage();
  const items = getCartItems().filter((item) => item.id !== itemId);
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  emitCartUpdated();
}

export function clearCartItems() {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.removeItem(CART_STORAGE_KEY);
  clearReorderMetaFromStorage();
  emitCartUpdated();
}

/** Replace the entire cart (e.g. reorder from account history). Each line gets a new id and timestamp. */
export function replaceCartWithLines(
  lines: Omit<CartItem, "id" | "addedAt">[],
  options?: { mockupImageUrls?: string[]; reorderedFromStoreOrderId?: string },
) {
  if (typeof window === "undefined") {
    return;
  }
  const items: CartItem[] = lines.map((line) => ({
    ...line,
    id: crypto.randomUUID(),
    addedAt: new Date().toISOString(),
  }));
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  const urls = (options?.mockupImageUrls ?? [])
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean);
  if (urls.length > 0) {
    window.localStorage.setItem(CART_REORDER_MOCKUPS_KEY, JSON.stringify(urls));
  } else {
    clearReorderMockupsFromStorage();
  }
  const src = (options?.reorderedFromStoreOrderId ?? "").trim();
  if (/^[0-9a-f-]{36}$/i.test(src)) {
    window.localStorage.setItem(CART_REORDER_SOURCE_ORDER_ID_KEY, src);
  } else {
    clearReorderSourceOrderIdFromStorage();
  }
  emitCartUpdated();
}

export function subscribeCartUpdates(listener: () => void) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const onStorage = (event: StorageEvent) => {
    if (
      event.key === CART_STORAGE_KEY ||
      event.key === CART_REORDER_MOCKUPS_KEY ||
      event.key === CART_REORDER_SOURCE_ORDER_ID_KEY
    ) {
      listener();
    }
  };

  const onCustom = () => listener();

  window.addEventListener("storage", onStorage);
  window.addEventListener(CART_UPDATED_EVENT, onCustom);

  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CART_UPDATED_EVENT, onCustom);
  };
}

function cartCountSnapshot(): number {
  return getCartCount();
}

function cartCountServerSnapshot(): number {
  return 0;
}

/**
 * Header badge / any UI tied to `localStorage` cart: server and the first hydrated client pass
 * both use count `0`, then subscribe updates — avoids React hydration attribute mismatches.
 */
export function useCartCount(): number {
  return useSyncExternalStore(subscribeCartUpdates, cartCountSnapshot, cartCountServerSnapshot);
}
