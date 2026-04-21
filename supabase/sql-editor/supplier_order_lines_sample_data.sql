-- Legacy sample rows are no longer used. To clear any remaining demo lines:
DELETE FROM public.supplier_order_lines
WHERE notes = 'SAMPLE:seed';

-- Prefer migration: supabase/migrations/20260434_remove_supplier_order_lines_sample_seed.sql
