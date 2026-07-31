-- Reusable series names -------------------------------------------------------
-- Series names repeat across categories (the same 漫花系列 exists under 上衣,
-- 褲裝, 洋裝…), so the owner had to retype them for every category. A 'series'
-- preset kind turns them into one-click chips, matching how 常用材質 works.

do $$
begin
  if exists (
    select 1 from pg_constraint
    where conrelid = 'public.content_presets'::regclass
      and conname = 'content_presets_kind_check'
  ) then
    alter table public.content_presets drop constraint content_presets_kind_check;
  end if;
end $$;

alter table public.content_presets
  add constraint content_presets_kind_check
    check (kind in ('material', 'care', 'size', 'series'));

-- Seed from the series that already exist, so the chips are useful immediately.
insert into public.content_presets (kind, value, position)
select
  'series',
  names.name,
  row_number() over (order by names.first_seen) - 1
from (
  select name, min(created_at) as first_seen
  from public.product_series
  group by name
) names
on conflict (kind, value) do nothing;
