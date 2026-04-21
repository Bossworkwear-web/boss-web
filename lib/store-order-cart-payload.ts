/** Cart lines accepted by `placeStoreOrder` (matches `CartItem` fields used at checkout). */
export type StoreOrderCartLine = {
  productId: string;
  /** Mirrors `products.supplier_name` when set (cart / reorder). */
  supplierName?: string;
  productName: string;
  serviceType: string;
  color: string;
  size: string;
  quantity: number;
  placements: string[];
  unitPrice: number;
  totalPrice: number;
  notes?: string;
  /** Same-origin Supabase public URLs attached at add-to-cart (logo uploads). */
  referenceImageUrls?: string[];
  /** Restored from `products.image_urls` when reordering (optional). */
  imageUrl?: string;
  /** Restored from `products` when reordering — correct `/products/[slug]` for Edit. */
  productPathSlug?: string;
};
