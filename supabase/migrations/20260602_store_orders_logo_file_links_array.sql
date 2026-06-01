-- Multiple embroidery / printing logo file links per order (text[]).
-- Safe if columns are still text (converts single value → one-element array) or already text[].

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'store_orders'
      and column_name = 'embroidery_logo_file_link'
      and data_type = 'text'
  ) then
    alter table public.store_orders
      alter column embroidery_logo_file_link type text[]
      using case
        when embroidery_logo_file_link is null or btrim(embroidery_logo_file_link) = '' then '{}'::text[]
        else array[btrim(embroidery_logo_file_link)]
      end;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'store_orders'
      and column_name = 'embroidery_logo_file_link'
  ) then
    alter table public.store_orders add column embroidery_logo_file_link text[] not null default '{}';
  end if;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'store_orders'
      and column_name = 'printing_logo_file_link'
      and data_type = 'text'
  ) then
    alter table public.store_orders
      alter column printing_logo_file_link type text[]
      using case
        when printing_logo_file_link is null or btrim(printing_logo_file_link) = '' then '{}'::text[]
        else array[btrim(printing_logo_file_link)]
      end;
  elsif not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'store_orders'
      and column_name = 'printing_logo_file_link'
  ) then
    alter table public.store_orders add column printing_logo_file_link text[] not null default '{}';
  end if;
end $$;

comment on column public.store_orders.embroidery_logo_file_link is
  'Staff-entered embroidery logo file links (paths or URLs), one per placement e.g. front/back/sleeve.';
comment on column public.store_orders.printing_logo_file_link is
  'Staff-entered printing logo file links (paths or URLs), one per placement e.g. front/back/sleeve.';
