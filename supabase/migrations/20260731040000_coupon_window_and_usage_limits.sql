-- Coupons gain an optional validity window and a usage limit, plus a
-- redemption log so "once overall" / "once per account" can be enforced.
alter table public.promotions
  add column if not exists starts_at timestamptz,
  add column if not exists ends_at timestamptz,
  add column if not exists usage_limit text not null default 'unlimited';

alter table public.promotions drop constraint if exists promotions_usage_limit_check;
alter table public.promotions add constraint promotions_usage_limit_check
  check (usage_limit in ('unlimited', 'once_total', 'once_per_account'));

alter table public.promotions drop constraint if exists promotions_window_check;
alter table public.promotions add constraint promotions_window_check
  check (starts_at is null or ends_at is null or ends_at > starts_at);

create table if not exists public.promotion_redemptions (
  id uuid primary key default gen_random_uuid(),
  promotion_id uuid not null references public.promotions(id) on delete cascade,
  code text not null,
  email text not null check (email = lower(btrim(email))),
  order_id uuid references public.orders(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists promotion_redemptions_promotion_idx
  on public.promotion_redemptions (promotion_id);
create index if not exists promotion_redemptions_promotion_email_idx
  on public.promotion_redemptions (promotion_id, email);
-- One row per order per promotion: makes recording idempotent if an order
-- submission is retried.
create unique index if not exists promotion_redemptions_promotion_order_key
  on public.promotion_redemptions (promotion_id, order_id)
  where order_id is not null;

alter table public.promotion_redemptions enable row level security;

drop policy if exists promotion_redemptions_admin_read on public.promotion_redemptions;
create policy promotion_redemptions_admin_read on public.promotion_redemptions
  for select to authenticated
  using (public.is_admin());
