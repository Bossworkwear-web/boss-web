alter table public.quote_requests add column if not exists quote_email_delivery_address_1 text;
alter table public.quote_requests add column if not exists quote_email_delivery_address_2 text;
alter table public.quote_requests add column if not exists quote_email_delivery_suburb text;
alter table public.quote_requests add column if not exists quote_email_delivery_state text;
alter table public.quote_requests add column if not exists quote_email_delivery_country text;
