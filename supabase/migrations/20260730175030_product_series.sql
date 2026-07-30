create table public.product_series (
  id uuid primary key default gen_random_uuid(),
  category_name text not null references public.product_categories(name)
    on update cascade on delete restrict,
  name text not null check (btrim(name) <> '' and char_length(name) <= 40),
  position integer not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index product_series_category_name_unique
  on public.product_series (category_name, lower(btrim(name)));

create index product_series_category_position_idx
  on public.product_series (category_name, position, created_at);

create table public.product_series_products (
  product_id uuid not null references public.products(id) on delete cascade,
  series_id uuid not null references public.product_series(id) on delete restrict,
  primary key (product_id, series_id)
);

create index product_series_products_series_idx
  on public.product_series_products (series_id, product_id);

create function public.validate_product_series_category()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  product_category text;
  series_category text;
begin
  select category into product_category
  from public.products
  where id = new.product_id;

  select category_name into series_category
  from public.product_series
  where id = new.series_id;

  if product_category is null
    or series_category is null
    or product_category <> series_category then
    raise exception 'product_series_category_mismatch';
  end if;

  return new;
end;
$$;

create trigger validate_product_series_category
before insert or update on public.product_series_products
for each row execute function public.validate_product_series_category();

create trigger product_series_set_updated_at
before update on public.product_series
for each row execute function public.set_updated_at();

alter table public.product_series enable row level security;
alter table public.product_series_products enable row level security;

grant select on public.product_series to anon, authenticated;
grant select on public.product_series_products to anon, authenticated;
grant insert, update, delete on public.product_series to authenticated;
grant insert, update, delete on public.product_series_products to authenticated;

create policy "product series are public"
on public.product_series for select
to anon, authenticated
using (true);

create policy "product series assignments are public"
on public.product_series_products for select
to anon, authenticated
using (true);

create policy "admins manage product series"
on public.product_series for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

create policy "admins manage product series assignments"
on public.product_series_products for all
to authenticated
using ((select public.is_admin()))
with check ((select public.is_admin()));

revoke execute on function public.validate_product_series_category() from public, anon, authenticated;
