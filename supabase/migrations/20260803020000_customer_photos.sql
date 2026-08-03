-- 大家怎麼穿 customer photo wall ------------------------------------------------
-- Owner-curated customer snapshots (from IG etc., with permission) attached to
-- a product; the product page shows them as social proof.

create table if not exists public.customer_photos (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete cascade,
  image_url text not null,
  caption text not null default '',
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists customer_photos_product_idx
  on public.customer_photos (product_id, position, created_at);

alter table public.customer_photos enable row level security;

drop policy if exists "customer photos are publicly readable" on public.customer_photos;
create policy "customer photos are publicly readable"
  on public.customer_photos for select
  using (true);

drop policy if exists "admins manage customer photos" on public.customer_photos;
create policy "admins manage customer photos"
  on public.customer_photos for all
  using (public.is_admin())
  with check (public.is_admin());
