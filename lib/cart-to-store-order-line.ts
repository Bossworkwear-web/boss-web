import type { CartItem } from "@/lib/cart";
import type { StoreOrderCartLine } from "@/lib/store-order-cart-payload";

/** Map browser cart lines to the payload stored for Stripe webhook fulfillment. */
export function cartItemToStoreOrderLine(item: CartItem): StoreOrderCartLine {
  return {
    productId: item.productId,
    supplierName: item.supplierName,
    productName: item.productName,
    category: item.category,
    serviceType: item.serviceType ?? "",
    color: item.color ?? "",
    size: item.size ?? "",
    quantity: item.quantity,
    placements: Array.isArray(item.placements) ? item.placements : [],
    listUnitPrice: item.listUnitPrice,
    unitPrice: item.unitPrice,
    totalPrice: item.totalPrice,
    notes: item.notes,
    referenceImageUrls: item.referenceImageUrls,
    imageUrl: item.imageUrl,
    productPathSlug: item.productPathSlug,
    specialDealPackageId: item.specialDealPackageId,
  };
}

export function cartItemsToStoreOrderLines(items: CartItem[]): StoreOrderCartLine[] {
  return items.map(cartItemToStoreOrderLine);
}
