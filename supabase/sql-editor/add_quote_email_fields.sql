-- Run in Supabase SQL Editor if migrations 20260468+ were not applied yet.
alter table public.quote_requests add column if not exists quote_email_product_id text;
alter table public.quote_requests add column if not exists quote_email_product_name text;
alter table public.quote_requests add column if not exists quote_email_total_cents integer;
alter table public.quote_requests add column if not exists quote_email_lead_time text;
alter table public.quote_requests add column if not exists quote_email_products jsonb not null default '[]'::jsonb;

alter table public.quote_requests add column if not exists quote_email_embroidery_service text;
alter table public.quote_requests add column if not exists quote_email_print_service text;
