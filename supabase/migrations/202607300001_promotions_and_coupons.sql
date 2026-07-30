-- Promotions / coupon codes -------------------------------------------------
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null default 'coupon'
    check (type in ('coupon', 'threshold_gift', 'quantity_discount')),
  code text,
  condition_value integer not null default 0 check (condition_value >= 0),
  reward_value integer not null default 0 check (reward_value >= 0),
  gift_name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One active/stored coupon per code (case-insensitive); gift/quantity promos
-- may leave the code blank.
create unique index if not exists promotions_coupon_code_key
  on public.promotions (upper(code))
  where type = 'coupon' and code is not null and code <> '';

drop trigger if exists promotions_set_updated_at on public.promotions;
create trigger promotions_set_updated_at before update on public.promotions
for each row execute function public.set_updated_at();

alter table public.promotions enable row level security;

drop policy if exists promotions_admin_manage on public.promotions;
create policy promotions_admin_manage on public.promotions
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Allow coupon discounts to reduce the payable total ------------------------
-- The original tables constrained `total = subtotal + shipping_fee`. Drop that
-- exact check (name-independently) so a discount can lower the total, and
-- replace it with a range check that still guards against nonsense values.
do $$
declare c text;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.payment_attempts'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%total%=%subtotal + shipping_fee%'
  loop
    execute format('alter table public.payment_attempts drop constraint %I', c);
  end loop;
  for c in
    select conname from pg_constraint
    where conrelid = 'public.orders'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%total%=%subtotal + shipping_fee%'
  loop
    execute format('alter table public.orders drop constraint %I', c);
  end loop;
end $$;

alter table public.payment_attempts
  add column if not exists coupon_code text,
  add column if not exists discount integer not null default 0 check (discount >= 0);

alter table public.payment_attempts
  drop constraint if exists payment_attempts_total_range_check;
alter table public.payment_attempts
  add constraint payment_attempts_total_range_check
    check (total >= 0 and total <= subtotal + shipping_fee);

alter table public.orders
  drop constraint if exists orders_total_range_check;
alter table public.orders
  add constraint orders_total_range_check
    check (total >= 0 and total <= subtotal + shipping_fee);
