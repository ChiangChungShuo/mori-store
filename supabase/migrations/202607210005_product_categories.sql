create table if not exists public.product_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (btrim(name) <> '' and char_length(name) <= 24),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now()
);

insert into public.product_categories (name, position)
values ('上衣', 0), ('褲裝', 1), ('洋裝', 2), ('外套', 3), ('幼兒服', 4)
on conflict (name) do nothing;

insert into public.product_categories (name, position)
select distinct btrim(category), 100
from public.products
where btrim(category) <> ''
on conflict (name) do nothing;

alter table public.product_categories enable row level security;

create policy "product categories are public"
on public.product_categories for select
using (true);

create policy "admins manage product categories"
on public.product_categories for all
using (exists (
  select 1 from public.profiles
  where profiles.id = auth.uid() and profiles.role = 'admin'
))
with check (exists (
  select 1 from public.profiles
  where profiles.id = auth.uid() and profiles.role = 'admin'
));
