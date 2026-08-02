-- Merge the two spellings of the 森語 series ---------------------------------
-- "Mori olive｜森語系列" (fullwidth ｜, lowercase o) and "Mori Olive|森語系列"
-- (halfwidth |, capital O) were created as separate series, so category pages
-- showed two identical-looking options. Canonical spelling follows the other
-- series (Mori Flora|…, Mori Lento|…): halfwidth bar, capitalized.

do $$
declare
  fullwidth_name text := 'Mori olive｜森語系列';
  canonical_name text := 'Mori Olive|森語系列';
  fullwidth record;
  canonical_id uuid;
begin
  for fullwidth in
    select id, category_name from public.product_series where name = fullwidth_name
  loop
    select id into canonical_id
    from public.product_series
    where name = canonical_name and category_name = fullwidth.category_name;

    if canonical_id is null then
      -- Only the fullwidth spelling exists in this category: rename in place,
      -- which keeps its product assignments untouched.
      update public.product_series
      set name = canonical_name
      where id = fullwidth.id;
    else
      -- Both exist: move any product links onto the canonical series, then
      -- drop the duplicate.
      insert into public.product_series_products (product_id, series_id)
      select product_id, canonical_id
      from public.product_series_products
      where series_id = fullwidth.id
      on conflict do nothing;

      delete from public.product_series_products where series_id = fullwidth.id;
      delete from public.product_series where id = fullwidth.id;
    end if;
  end loop;

  -- Retire the fullwidth reusable chip so it cannot be re-added by one click.
  delete from public.content_presets
  where kind = 'series' and value = fullwidth_name;
end $$;
