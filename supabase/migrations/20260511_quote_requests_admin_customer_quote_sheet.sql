-- Persist full Customer Quote (admin) spreadsheet for list + reopen.
alter table public.quote_requests
  add column if not exists admin_customer_quote_sheet jsonb;

comment on column public.quote_requests.admin_customer_quote_sheet is
  'Optional v1 JSON snapshot from /admin/customer-quote (Save Quote).';
