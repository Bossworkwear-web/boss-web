alter table public.quote_requests add column if not exists quote_portal_token text;
alter table public.quote_requests add column if not exists quote_customer_accepted_at timestamptz;
alter table public.quote_requests add column if not exists quote_customer_accept_payload jsonb;

create unique index if not exists quote_requests_quote_portal_token_uidx
  on public.quote_requests (quote_portal_token)
  where quote_portal_token is not null;
