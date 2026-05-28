-- Raw Get a Quote form payload for admin Online Quote view (original submission).

alter table public.quote_requests
  add column if not exists website_quote_submission jsonb;

comment on column public.quote_requests.website_quote_submission is
  'Snapshot of the public Get a Quote form as submitted (product_spec, placements, notes, logo, etc.).';
