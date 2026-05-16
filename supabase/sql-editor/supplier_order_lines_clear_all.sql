-- Clear every supplier order line and daily-sheet ready flag (Supplier orders admin reset).
-- Does not delete store_orders, click_up_sheet_list, or Click Up queues.

DELETE FROM public.supplier_order_lines;

DELETE FROM public.supplier_daily_sheets;
