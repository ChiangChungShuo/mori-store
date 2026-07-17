alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.product_images enable row level security;
alter table public.product_variants enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_attempts enable row level security;

grant execute on function public.is_admin() to anon, authenticated;

create policy "members read own profile"
on public.profiles for select
using (auth.uid() = id or public.is_admin());

create policy "members update own profile"
on public.profiles for update
using (auth.uid() = id or public.is_admin())
with check (auth.uid() = id or public.is_admin());

create policy "admins insert profiles"
on public.profiles for insert
with check (public.is_admin());

create policy "admins delete profiles"
on public.profiles for delete
using (public.is_admin());

create policy "published products are public"
on public.products for select
using (is_published or public.is_admin());

create policy "admins manage products"
on public.products for all
using (public.is_admin())
with check (public.is_admin());

create policy "published product images are public"
on public.product_images for select
using (
  exists (
    select 1 from public.products
    where products.id = product_images.product_id
      and (products.is_published or public.is_admin())
  )
);

create policy "admins manage product images"
on public.product_images for all
using (public.is_admin())
with check (public.is_admin());

create policy "published product variants are public"
on public.product_variants for select
using (
  exists (
    select 1 from public.products
    where products.id = product_variants.product_id
      and (products.is_published or public.is_admin())
  )
);

create policy "admins manage product variants"
on public.product_variants for all
using (public.is_admin())
with check (public.is_admin());

create policy "store settings are public"
on public.store_settings for select
using (true);

create policy "admins manage store settings"
on public.store_settings for all
using (public.is_admin())
with check (public.is_admin());

create policy "members read own orders"
on public.orders for select
using (auth.uid() = user_id or public.is_admin());

create policy "admins manage orders"
on public.orders for all
using (public.is_admin())
with check (public.is_admin());

create policy "members read own order items"
on public.order_items for select
using (
  exists (
    select 1 from public.orders
    where orders.id = order_items.order_id
      and (orders.user_id = auth.uid() or public.is_admin())
  )
);

create policy "admins manage order items"
on public.order_items for all
using (public.is_admin())
with check (public.is_admin());

create policy "members read own payment attempts"
on public.payment_attempts for select
using (auth.uid() = user_id or public.is_admin());

create policy "admins manage payment attempts"
on public.payment_attempts for all
using (public.is_admin())
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do update set public = excluded.public;

create policy "product images are public"
on storage.objects for select
using (bucket_id = 'product-images');

create policy "admins manage product image storage"
on storage.objects for all
using (bucket_id = 'product-images' and public.is_admin())
with check (bucket_id = 'product-images' and public.is_admin());
