-- Multiple products for CRM "Send quote" customer email draft (JSON array of { product_id, product_name }).
alter table public.quote_requests add column if not exists quote_email_products jsonb not null default '[]'::jsonb;
