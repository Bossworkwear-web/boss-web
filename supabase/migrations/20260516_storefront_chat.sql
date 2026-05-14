-- Storefront live chat: one thread per browser visitor_key; messages from guest or staff.

create table if not exists public.storefront_chat_threads (
  id uuid primary key default gen_random_uuid(),
  visitor_key text not null unique,
  visitor_name text,
  visitor_email text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists storefront_chat_threads_updated_at_idx
  on public.storefront_chat_threads (updated_at desc);

create table if not exists public.storefront_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.storefront_chat_threads (id) on delete cascade,
  sender text not null check (sender in ('guest', 'staff')),
  body text not null,
  staff_identifier text,
  created_at timestamptz not null default now()
);

create index if not exists storefront_chat_messages_thread_created_idx
  on public.storefront_chat_messages (thread_id, created_at asc);

comment on table public.storefront_chat_threads is 'Public site chat; keyed by anonymous visitor_key from browser.';
comment on table public.storefront_chat_messages is 'Chat lines; sender guest (storefront) or staff (admin).';
