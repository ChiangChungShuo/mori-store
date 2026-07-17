alter table public.product_variants
add column is_active boolean not null default true;

alter table public.products
add constraint products_name_not_blank check (btrim(name) <> ''),
add constraint products_slug_not_blank check (btrim(slug) <> ''),
add constraint products_category_not_blank check (btrim(category) <> ''),
add constraint products_age_bands_not_empty check (cardinality(age_bands) > 0);

alter table public.product_variants
add constraint product_variants_sku_not_blank check (btrim(sku) <> ''),
add constraint product_variants_color_not_blank check (btrim(color) <> ''),
add constraint product_variants_size_not_blank check (btrim(size) <> '');

do $$
begin
  if exists (
    select lower(btrim(sku))
    from public.product_variants
    group by lower(btrim(sku))
    having count(*) > 1
  ) then
    raise exception 'case-insensitive duplicate product variant SKUs must be resolved first';
  end if;
end;
$$;

alter table public.product_variants
drop constraint product_variants_sku_key;

update public.product_variants
set sku = upper(btrim(sku));

alter table public.product_variants
add constraint product_variants_sku_canonical check (sku = upper(btrim(sku)));

create unique index product_variants_sku_lower_key
on public.product_variants (lower(sku));

alter table public.product_variants
drop constraint product_variants_product_id_color_size_key;

create unique index product_variants_active_color_size_key
on public.product_variants (product_id, lower(color), lower(size))
where is_active;

drop policy "published product variants are public" on public.product_variants;
create policy "published product variants are public"
on public.product_variants for select
using (
  public.is_admin()
  or (
    is_active and exists (
      select 1 from public.products
      where products.id = product_variants.product_id
        and products.is_published
    )
  )
);

create or replace function public.admin_update_product(
  p_product_id uuid,
  p_product jsonb,
  p_variants jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  variant_data jsonb;
  variant_id uuid;
  kept_variant_ids uuid[] := '{}'::uuid[];
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  if jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) < 1 then
    raise exception 'variant_required';
  end if;

  perform 1
  from public.products
  where id = p_product_id
  for update;
  if not found then
    raise exception 'product_not_found';
  end if;

  perform id
  from public.product_variants
  where product_id = p_product_id
  order by id
  for update;

  if exists (
    select 1
    from jsonb_array_elements(p_variants) as requested(value)
    where requested.value ? 'id'
      and not exists (
        select 1
        from public.product_variants existing
        where existing.id = (requested.value ->> 'id')::uuid
          and existing.product_id = p_product_id
      )
  ) then
    raise exception 'variant_not_owned';
  end if;

  if (
    select count(*) <> count(distinct requested.value ->> 'id')
    from jsonb_array_elements(p_variants) as requested(value)
    where requested.value ? 'id'
  ) then
    raise exception 'duplicate_variant_id';
  end if;

  update public.products
  set name = p_product ->> 'name',
    slug = p_product ->> 'slug',
    category = p_product ->> 'category',
    age_bands = array(
      select value::public.age_band
      from jsonb_array_elements_text(p_product -> 'ageBands') as age(value)
    ),
    description = coalesce(p_product ->> 'description', ''),
    material = coalesce(p_product ->> 'material', ''),
    care_instructions = coalesce(p_product ->> 'careInstructions', ''),
    size_guide = coalesce(p_product ->> 'sizeGuide', ''),
    is_new = coalesce((p_product ->> 'isNew')::boolean, false)
  where id = p_product_id;

  update public.product_variants
  set is_active = false
  where product_id = p_product_id
    and is_active;

  for variant_data in
    select value from jsonb_array_elements(p_variants)
  loop
    variant_id := nullif(variant_data ->> 'id', '')::uuid;

    if variant_id is null then
      insert into public.product_variants (
        product_id, sku, color, size, price, compare_at_price, stock, is_active
      ) values (
        p_product_id,
        upper(btrim(variant_data ->> 'sku')),
        btrim(variant_data ->> 'color'),
        btrim(variant_data ->> 'size'),
        (variant_data ->> 'price')::integer,
        case when variant_data ? 'compareAtPrice'
          then (variant_data ->> 'compareAtPrice')::integer else null end,
        (variant_data ->> 'stock')::integer,
        true
      ) returning id into variant_id;
    else
      update public.product_variants
      set sku = upper(btrim(variant_data ->> 'sku')),
        color = btrim(variant_data ->> 'color'),
        size = btrim(variant_data ->> 'size'),
        price = (variant_data ->> 'price')::integer,
        compare_at_price = case when variant_data ? 'compareAtPrice'
          then (variant_data ->> 'compareAtPrice')::integer else null end,
        stock = (variant_data ->> 'stock')::integer,
        is_active = true
      where id = variant_id
        and product_id = p_product_id;
      if not found then
        raise exception 'variant_not_owned';
      end if;
    end if;

    kept_variant_ids := array_append(kept_variant_ids, variant_id);
  end loop;

  update public.product_variants
  set is_active = false
  where product_id = p_product_id
    and not (id = any(kept_variant_ids));
end;
$$;

create or replace function public.admin_create_product(
  p_product jsonb,
  p_variants jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  product_id uuid;
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  insert into public.products (
    name, slug, category, age_bands, description, material,
    care_instructions, size_guide, is_new
  ) values (
    p_product ->> 'name',
    p_product ->> 'slug',
    p_product ->> 'category',
    array(
      select value::public.age_band
      from jsonb_array_elements_text(p_product -> 'ageBands') as age(value)
    ),
    coalesce(p_product ->> 'description', ''),
    coalesce(p_product ->> 'material', ''),
    coalesce(p_product ->> 'careInstructions', ''),
    coalesce(p_product ->> 'sizeGuide', ''),
    coalesce((p_product ->> 'isNew')::boolean, false)
  ) returning id into product_id;

  perform public.admin_update_product(product_id, p_product, p_variants);
  return product_id;
end;
$$;

create or replace function public.admin_set_product_published(
  p_product_id uuid,
  p_published boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;

  perform 1
  from public.products
  where id = p_product_id
  for update;
  if not found then
    raise exception 'product_not_found';
  end if;

  if p_published and not exists (
    select 1 from public.product_images where product_id = p_product_id
  ) then
    raise exception 'product_image_required';
  end if;

  if p_published and not exists (
    select 1
    from public.product_variants
    where product_id = p_product_id
      and is_active
      and stock > 0
  ) then
    raise exception 'in_stock_variant_required';
  end if;

  update public.products
  set is_published = p_published
  where id = p_product_id;
end;
$$;

create or replace function public.admin_insert_product_image(
  p_product_id uuid,
  p_storage_path text,
  p_alt_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  image_id uuid;
  next_position integer;
begin
  if not public.is_admin() then
    raise exception 'admin_required';
  end if;
  if btrim(p_storage_path) = '' or btrim(p_alt_text) = '' then
    raise exception 'image_data_required';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_product_id::text, 0));

  select coalesce(max(position), -1) + 1 into next_position
  from public.product_images
  where product_id = p_product_id;

  insert into public.product_images (product_id, storage_path, alt_text, position)
  values (p_product_id, p_storage_path, btrim(p_alt_text), next_position)
  returning id into image_id;

  return image_id;
end;
$$;

create or replace function public.prevent_inactive_variant_sale()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if not old.is_active and not new.is_active and new.stock < old.stock then
    raise exception 'product variant is inactive';
  end if;
  return new;
end;
$$;

create trigger product_variants_prevent_inactive_sale
before update of stock on public.product_variants
for each row execute function public.prevent_inactive_variant_sale();

revoke all on function public.admin_create_product(jsonb, jsonb) from public, anon;
revoke all on function public.admin_update_product(uuid, jsonb, jsonb) from public, anon;
revoke all on function public.admin_set_product_published(uuid, boolean) from public, anon;
revoke all on function public.admin_insert_product_image(uuid, text, text) from public, anon;
grant execute on function public.admin_create_product(jsonb, jsonb) to authenticated;
grant execute on function public.admin_update_product(uuid, jsonb, jsonb) to authenticated;
grant execute on function public.admin_set_product_published(uuid, boolean) to authenticated;
grant execute on function public.admin_insert_product_image(uuid, text, text) to authenticated;
