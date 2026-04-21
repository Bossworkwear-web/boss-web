-- Storefront audience gating (Men's / Women's / Kid's / Unisex).
alter table public.products
  add column if not exists audience text;

comment on column public.products.audience is
  'Audience gate for category browse: mens|womens|kids|unisex (optional). When null/empty, fallback to legacy heuristics.';

