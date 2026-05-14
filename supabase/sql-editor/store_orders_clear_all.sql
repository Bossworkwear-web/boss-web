-- Clear every store checkout order (and line items cascade). Use for wiping test data in SQL Editor.
-- Same as: supabase/migrations/20260435_clear_store_orders.sql

DELETE FROM public.store_orders;
