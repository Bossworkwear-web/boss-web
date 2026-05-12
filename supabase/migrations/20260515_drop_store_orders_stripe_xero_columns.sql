-- Remove Stripe session / Xero invoice columns added for abandoned integration.
drop index if exists public.store_orders_stripe_session_id_unique;
drop index if exists public.store_orders_xero_invoice_id_unique;

alter table public.store_orders drop column if exists stripe_session_id;
alter table public.store_orders drop column if exists xero_invoice_id;
