-- Bind storefront chat threads to logged-in customer email (with visitor_key for device).

alter table public.storefront_chat_threads
  add column if not exists customer_email text;

update public.storefront_chat_threads
set customer_email = lower(trim(visitor_email))
where customer_email is null
  and visitor_email is not null
  and length(trim(visitor_email)) > 0;

delete from public.storefront_chat_messages
where thread_id in (select id from public.storefront_chat_threads where customer_email is null);

delete from public.storefront_chat_threads where customer_email is null;

alter table public.storefront_chat_threads drop constraint if exists storefront_chat_threads_visitor_key_key;

drop index if exists storefront_chat_threads_visitor_key_key;

create unique index if not exists storefront_chat_threads_visitor_customer_uniq
  on public.storefront_chat_threads (visitor_key, customer_email);

alter table public.storefront_chat_threads alter column customer_email set not null;

comment on table public.storefront_chat_threads is 'Storefront chat; one row per visitor_key + logged-in customer_email.';
