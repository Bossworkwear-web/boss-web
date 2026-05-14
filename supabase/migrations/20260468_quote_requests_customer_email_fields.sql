-- Fields staff fill on CRM "Send quote" page to draft the customer email (GST-inclusive total, lead time, etc.).
alter table public.quote_requests add column if not exists quote_email_product_id text;
alter table public.quote_requests add column if not exists quote_email_product_name text;
alter table public.quote_requests add column if not exists quote_email_total_cents integer;
alter table public.quote_requests add column if not exists quote_email_lead_time text;
