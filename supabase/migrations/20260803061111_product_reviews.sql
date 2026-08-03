-- Verified-purchase product reviews -----------------------------------------
-- Public readers may only select the non-identifying columns granted below.
-- The member UUID remains server-only and is used to enforce one review per
-- member and product.

create table public.product_reviews (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  body text not null check (char_length(btrim(body)) between 2 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_id, user_id)
);

create index product_reviews_product_created_idx
  on public.product_reviews (product_id, created_at desc);

create index product_reviews_user_idx
  on public.product_reviews (user_id);

create trigger product_reviews_set_updated_at
before update on public.product_reviews
for each row execute function public.set_updated_at();

alter table public.product_reviews enable row level security;

revoke all on public.product_reviews from anon, authenticated;
grant select (id, product_id, rating, body, created_at, updated_at)
  on public.product_reviews to anon, authenticated;
grant all on public.product_reviews to service_role;

create policy "published product reviews are public"
on public.product_reviews for select
to anon, authenticated
using (
  exists (
    select 1
    from public.products
    where products.id = product_reviews.product_id
      and products.is_published
  )
);
