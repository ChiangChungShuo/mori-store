insert into public.store_settings (key, value)
values (
  'home_banner_slides',
  '[{"imageUrl":"/images/mori-hero.jpg","imageAlt":"兩位穿著舒適童裝的孩子在庭院散步","eyebrow":"mori summer edit · 2026","title":"小小日常，\n自在長大。","body":"替 0–12 歲孩子挑選柔軟、好活動、每天都願意穿的衣服。","buttonLabel":"選購本週新品","buttonHref":"/#new"}]'::jsonb
)
on conflict (key) do nothing;
