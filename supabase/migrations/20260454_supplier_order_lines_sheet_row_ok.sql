-- Per-line OK flag for Supplier orders worksheet (persisted with Ready / snapshot save).
ALTER TABLE public.supplier_order_lines
  ADD COLUMN IF NOT EXISTS sheet_row_ok boolean NOT NULL DEFAULT false;

NOTIFY pgrst, 'reload schema';
