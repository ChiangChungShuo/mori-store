-- Admin-managed member overrides: tier, loyalty points and a personal
-- discount, keyed by email (members and guest buyers alike are identified by
-- the email on their orders). Without a row, the app falls back to values
-- derived from order history.
create table if not exists public.member_profiles (
  email text primary key check (email = lower(btrim(email))),
  tier text not null default 'seed' check (tier in ('seed', 'forest', 'canopy')),
  points integer not null default 0 check (points >= 0),
  discount_percent integer not null default 0 check (discount_percent between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists member_profiles_set_updated_at on public.member_profiles;
create trigger member_profiles_set_updated_at before update on public.member_profiles
for each row execute function public.set_updated_at();

alter table public.member_profiles enable row level security;

drop policy if exists member_profiles_admin_manage on public.member_profiles;
create policy member_profiles_admin_manage on public.member_profiles
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
