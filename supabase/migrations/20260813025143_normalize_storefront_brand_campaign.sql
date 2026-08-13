-- Keep live presentation data consistent with the MORIMUR BABY brand. Product
-- slugs stay untouched so existing links and search indexing remain stable.
insert into public.store_settings (key, value)
values ('free_shipping_threshold', jsonb_build_object('amount', 2000))
on conflict (key) do update set value = excluded.value;

update public.store_settings
set value = jsonb_set(value, '{text}', to_jsonb('MORIMUR BABY｜0–12 歲孩子的日常選衣'::text))
where key = 'site_title';

update public.store_settings
set value = (
  select jsonb_agg(
    jsonb_set(slide, '{eyebrow}', to_jsonb('MORIMUR BABY seasonal edit'::text))
    order by ordinal
  )
  from jsonb_array_elements(value) with ordinality as banners(slide, ordinal)
)
where key = 'home_banner_slides'
  and jsonb_typeof(value) = 'array';

update public.product_series
set name = case
  when name ~* '^Mori\s+(Lento|Lemto)' then 'Mori Lento｜慢日系列'
  when name ~* '^Mori\s+Flora' then 'Mori Flora｜漫花系列'
  when name ~* '^Mori\s+Olive' then 'Mori Olive｜森語系列'
  when name ~* '^Mori\s+Blanche' then 'Mori Blanche｜純境系列'
  when name ~* '^Mori\s+Lumi' then 'Mori Lumi｜拾光系列'
  when name ~* '^Mori\s+Campus' then 'Mori Campus｜學院系列'
  else btrim(name)
end
where name ~* '^Mori\s+(Lento|Lemto|Flora|Olive|Blanche|Lumi|Campus)';

update public.products
set name = regexp_replace(
  regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(
          regexp_replace(
            name,
            'Mori\s+(Lento|Lemto)(\s*慢日系列)?', 'Mori Lento', 'gi'
          ),
          'Mori\s+Flora(\s*漫花系列)?', 'Mori Flora', 'gi'
        ),
        'Mori\s+Olive(\s*森語系列)?', 'Mori Olive', 'gi'
      ),
      'Mori\s+Blanche(\s*(純境|白境)系列)?', 'Mori Blanche', 'gi'
    ),
    'Mori\s+Lumi(\s*(拾光|微光)系列)?', 'Mori Lumi', 'gi'
  ),
  '\s*[|｜]\s*', '｜', 'g'
)
where name ~* 'Mori\s+(Lento|Lemto|Flora|Olive|Blanche|Lumi)';

update public.products
set name = regexp_replace(
  regexp_replace(name, 'Mori\s+Campus(\s*學院系列)?', 'Mori Campus', 'gi'),
  '\s*[|｜]\s*', '｜', 'g'
)
where name ~* 'Mori\s+Campus';

update public.products
set seo_title = name || '｜MORIMUR BABY'
where seo_title is not null;
