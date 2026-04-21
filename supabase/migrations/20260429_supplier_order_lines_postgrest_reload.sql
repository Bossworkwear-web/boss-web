-- Ensures PostgREST picks up supplier_order_lines after migrations (avoids stale schema cache).
notify pgrst, 'reload schema';
