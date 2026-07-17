insert into public.products (
  slug, name, description, category, age_bands, material, care_instructions, size_guide, is_new, is_published
) values (
  'mori-organic-cotton-tee',
  '有機棉小樹 T 恤',
  '柔軟透氣的日常有機棉 T 恤。',
  '上衣',
  array['3-5', '6-9']::public.age_band[],
  '100% 有機棉',
  '建議冷水洗滌，低溫烘乾。',
  '版型正常，請依孩子平常尺寸選購。',
  true,
  true
)
on conflict (slug) do nothing;

insert into public.product_variants (product_id, sku, color, size, price, compare_at_price, stock, is_active)
select id, 'MORI-TEE-SAGE-100', '鼠尾草綠', '100', 680, 780, 12, true
from public.products
where slug = 'mori-organic-cotton-tee'
on conflict (lower(sku)) do nothing;

insert into public.product_variants (product_id, sku, color, size, price, compare_at_price, stock, is_active)
select id, 'MORI-TEE-SAGE-120', '鼠尾草綠', '120', 680, 780, 8, true
from public.products
where slug = 'mori-organic-cotton-tee'
on conflict (lower(sku)) do nothing;

insert into public.store_settings (key, value)
values ('shipping_fee', '{"amount": 60}'::jsonb)
on conflict (key) do update set value = excluded.value;
