-- Product listing enrichment: short summary, tags, and per-product SEO fields.
alter table public.products
  add column if not exists summary text not null default '',
  add column if not exists tags text[] not null default '{}'::text[],
  add column if not exists seo_title text not null default '',
  add column if not exists seo_description text not null default '';

-- admin_create_product delegates all non-NOT-NULL fields to admin_update_product,
-- so extending the update function covers both create and update paths.
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
  if not public.is_admin() then raise exception 'admin_required'; end if;
  if jsonb_typeof(p_variants) <> 'array' or jsonb_array_length(p_variants) < 1 then raise exception 'variant_required'; end if;

  perform 1 from public.products where id = p_product_id for update;
  if not found then raise exception 'product_not_found'; end if;
  perform id from public.product_variants where product_id = p_product_id order by id for update;

  if exists (
    select 1 from jsonb_array_elements(p_variants) requested(value)
    where requested.value ? 'id' and not exists (
      select 1 from public.product_variants existing
      where existing.id = (requested.value ->> 'id')::uuid and existing.product_id = p_product_id
    )
  ) then raise exception 'variant_not_owned'; end if;

  if (select count(*) <> count(distinct requested.value ->> 'id') from jsonb_array_elements(p_variants) requested(value) where requested.value ? 'id') then
    raise exception 'duplicate_variant_id';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_variants) requested(value)
    join public.product_variants existing on existing.id = (requested.value ->> 'id')::uuid and existing.product_id = p_product_id
    where requested.value ? 'id' and (
      nullif(requested.value ->> 'updatedAt', '') is null
      or existing.updated_at is distinct from (requested.value ->> 'updatedAt')::timestamptz
    )
  ) then raise exception 'stale_product_variant'; end if;

  update public.products set
    name = p_product ->> 'name', slug = p_product ->> 'slug', category = p_product ->> 'category',
    age_bands = array(select value::public.age_band from jsonb_array_elements_text(p_product -> 'ageBands') age(value)),
    description = coalesce(p_product ->> 'description', ''), material = coalesce(p_product ->> 'material', ''),
    care_instructions = coalesce(p_product ->> 'careInstructions', ''), size_guide = coalesce(p_product ->> 'sizeGuide', ''),
    summary = coalesce(p_product ->> 'summary', ''),
    seo_title = coalesce(p_product ->> 'seoTitle', ''),
    seo_description = coalesce(p_product ->> 'seoDescription', ''),
    tags = coalesce(
      array(
        select btrim(value)
        from jsonb_array_elements_text(coalesce(p_product -> 'tags', '[]'::jsonb)) as t(value)
        where btrim(value) <> ''
      ),
      '{}'::text[]
    ),
    is_new = coalesce((p_product ->> 'isNew')::boolean, false),
    available_at = nullif(p_product ->> 'availableAt', '')::timestamptz
  where id = p_product_id;

  update public.product_variants set is_active = false, updated_at = clock_timestamp()
  where product_id = p_product_id and is_active;

  for variant_data in select value from jsonb_array_elements(p_variants) loop
    variant_id := nullif(variant_data ->> 'id', '')::uuid;
    if variant_id is null then
      insert into public.product_variants (product_id, sku, color, size, price, compare_at_price, stock, is_active)
      values (p_product_id, upper(btrim(variant_data ->> 'sku')), btrim(variant_data ->> 'color'), btrim(variant_data ->> 'size'),
        (variant_data ->> 'price')::integer,
        case when variant_data ? 'compareAtPrice' then (variant_data ->> 'compareAtPrice')::integer else null end,
        (variant_data ->> 'stock')::integer, true) returning id into variant_id;
    else
      update public.product_variants set sku = upper(btrim(variant_data ->> 'sku')), color = btrim(variant_data ->> 'color'),
        size = btrim(variant_data ->> 'size'), price = (variant_data ->> 'price')::integer,
        compare_at_price = case when variant_data ? 'compareAtPrice' then (variant_data ->> 'compareAtPrice')::integer else null end,
        stock = (variant_data ->> 'stock')::integer, is_active = true, updated_at = clock_timestamp()
      where id = variant_id and product_id = p_product_id;
      if not found then raise exception 'variant_not_owned'; end if;
    end if;
    kept_variant_ids := array_append(kept_variant_ids, variant_id);
  end loop;

  if exists (select 1 from public.product_variants where product_id = p_product_id and is_active and not (id = any(kept_variant_ids))) then
    raise exception 'variant_sync_failed';
  end if;
end;
$$;
