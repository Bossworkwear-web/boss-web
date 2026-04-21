-- Remove all storefront paid orders and their line items (FK: store_order_items → store_orders ON DELETE CASCADE).
-- Run when clearing test checkouts; next checkout reuses BOS_YYYYMMDD_001 for that Perth day if no rows remain.

delete from public.store_orders;
