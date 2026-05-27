-- Store credit balances (redeemable on next online order) + ledger audit trail.

create table if not exists public.customer_store_credit_balances (
  customer_email text primary key,
  balance_cents integer not null default 0 check (balance_cents >= 0),
  updated_at timestamptz not null default now()
);

create index if not exists customer_store_credit_balances_updated_idx
  on public.customer_store_credit_balances (updated_at desc);

create table if not exists public.customer_store_credit_ledger (
  id uuid primary key default gen_random_uuid(),
  customer_email text not null,
  amount_cents integer not null,
  balance_after_cents integer not null check (balance_after_cents >= 0),
  kind text not null check (kind in ('issue', 'redeem', 'adjust')),
  source_store_order_id uuid references public.store_orders (id) on delete set null,
  store_order_id uuid references public.store_orders (id) on delete set null,
  note text,
  created_by text,
  created_at timestamptz not null default now()
);

create index if not exists customer_store_credit_ledger_email_created_idx
  on public.customer_store_credit_ledger (customer_email, created_at desc);

create index if not exists customer_store_credit_ledger_source_order_idx
  on public.customer_store_credit_ledger (source_store_order_id)
  where source_store_order_id is not null;

alter table public.store_orders
  add column if not exists store_credit_applied_cents integer not null default 0;

alter table public.store_checkout_pending
  add column if not exists store_credit_applied_cents integer not null default 0;

comment on table public.customer_store_credit_balances is
  'Running store credit balance per customer email (lowercase). Redeemable at checkout.';

comment on column public.store_orders.store_credit_applied_cents is
  'Store credit applied to this order at checkout (AUD cents). Card/Stripe paid total_cents minus this.';

-- Issue credit (admin — refund alternative).
create or replace function public.issue_customer_store_credit(
  p_email text,
  p_amount_cents integer,
  p_source_store_order_id uuid default null,
  p_note text default null,
  p_created_by text default null
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_new_balance integer;
begin
  if v_email = '' then
    raise exception 'Email is required';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Amount must be positive';
  end if;

  insert into public.customer_store_credit_balances (customer_email, balance_cents, updated_at)
  values (v_email, p_amount_cents, now())
  on conflict (customer_email) do update
    set balance_cents = customer_store_credit_balances.balance_cents + excluded.balance_cents,
        updated_at = now()
  returning balance_cents into v_new_balance;

  insert into public.customer_store_credit_ledger (
    customer_email,
    amount_cents,
    balance_after_cents,
    kind,
    source_store_order_id,
    note,
    created_by
  ) values (
    v_email,
    p_amount_cents,
    v_new_balance,
    'issue',
    p_source_store_order_id,
    nullif(trim(p_note), ''),
    nullif(trim(p_created_by), '')
  );

  return v_new_balance;
end;
$$;

-- Redeem credit at checkout (atomic).
create or replace function public.redeem_customer_store_credit(
  p_email text,
  p_amount_cents integer,
  p_store_order_id uuid
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(p_email));
  v_new_balance integer;
begin
  if v_email = '' then
    raise exception 'Email is required';
  end if;
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_store_order_id is null then
    raise exception 'Order id is required';
  end if;

  update public.customer_store_credit_balances
  set balance_cents = balance_cents - p_amount_cents,
      updated_at = now()
  where customer_email = v_email
    and balance_cents >= p_amount_cents
  returning balance_cents into v_new_balance;

  if not found then
    raise exception 'Insufficient store credit';
  end if;

  insert into public.customer_store_credit_ledger (
    customer_email,
    amount_cents,
    balance_after_cents,
    kind,
    store_order_id
  ) values (
    v_email,
    -p_amount_cents,
    v_new_balance,
    'redeem',
    p_store_order_id
  );

  return v_new_balance;
end;
$$;

grant execute on function public.issue_customer_store_credit(text, integer, uuid, text, text) to service_role;
grant execute on function public.redeem_customer_store_credit(text, integer, uuid) to service_role;
